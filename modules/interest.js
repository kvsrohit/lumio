function _getNextInterestDate(loan, current) {
  var nextDate = new Date(current.getTime());
  if (nextDate.getUTCDate() >= loan.paymentDay) {
    nextDate.setUTCMonth(current.getUTCMonth() + _getPeriodLength(loan.interestFrequency));
  }
  nextDate.setUTCDate(loan.paymentDay);
  return nextDate;
}

function _getNextPrincipalDate(loan, current) {
  var nextDate = new Date(current.getTime());
  if (nextDate.getUTCDate() >= loan.paymentDay) {
    nextDate.setUTCMonth(current.getUTCMonth() + _getPeriodLength(loan.amortFrequency));
  }
  nextDate.setUTCDate(loan.paymentDay);
  return nextDate;
}

/* Return a date that is N days after start */
function _addDays(start, n) {
  return new Date(start.getTime() + (n * 24 * 3600 * 1000));
}

/* Get number of days between two dates */
function _getDays(start, end) {
  return Math.floor((end - start) / (24 * 3600 * 1000));
}

function roundAmount(num) {
  return Math.round(num);
}

/* Get length of period on a 30/360 basis */
function _getPeriodLength(frequency){
  switch(frequency) {
  case 'Monthly': return 1;
  case 'Quarterly': return 3;
  case 'Semi': return 6;
  default : return 12;
  }
}

/* Get length of period on a 30/360 basis */
function _getPeriodDays(frequency){
  return 30 * _getPeriodLength(frequency);
}

function calculateInterest(amount, rate, frequency, start, end) {
  var days = _getDays(start, end);
  var periodLength = _getPeriodDays(frequency);
  return getInterestForPeriod(amount, rate, days / periodLength);
}

function getInterestForPeriod(amount, rate, period) {
  return roundAmount(amount * rate * period / 100);
}

function getFullPeriodInterest(loan) {
  return getInterestForPeriod(loan.amount, loan.interestRate, 1);
}

function stubApplicable(loan) {
  return (loan.startDate.getUTCDate() != loan.paymentDay);
}

function generateSchedule(loan, calcDate) {

  var schedule = {
    interests: [],
    principals:[],
    accrued: {
      amount: 0,
      date: calcDate
    }
  };
  if (!loan || !loan.startDate || !loan.amount) {
    return schedule;
  }
  if (typeof loan.startDate === 'string') {
    loan.startDate = new Date(loan.startDate);
  }
  var startDate = loan.startDate;
  loan.paymentDay = loan.paymentDay || startDate.getUTCDate();

  var outstandingPrincipal = loan.amount;
  var principalFlows = _prepareFlows(loan.payments, 'principal');

  var currentDate = startDate;
  var nextDate = _getNextInterestDate(loan, currentDate);

  if ((nextDate > startDate) && (nextDate < calcDate) && stubApplicable(loan)) {
    var interest = calculateInterest(outstandingPrincipal, loan.interestRate, loan.interestFrequency, startDate, nextDate);
    schedule.interests.push({
      principal: outstandingPrincipal,
      amount: interest,
      date: nextDate
    });
    currentDate = nextDate;
    nextDate = _getNextInterestDate(loan, nextDate);
  }
  var periodInterest = getInterestForPeriod(outstandingPrincipal, loan.interestRate, 1);
  while (nextDate <= calcDate) {

    // if(principalFlows.length > 0){
    //   console.log(principalFlows[0], principalFlows[0].date, _addDays(currentDate, loan.leasePeriod), principalFlows[0].date <= _addDays(currentDate, loan.leasePeriod));
    // } else {
    //   console.log('No principal flows');
    // }
    while (principalFlows.length > 0 && principalFlows[0].date <= _addDays(currentDate, loan.leasePeriod)) {
      //console.log('Reducing 1 ', principalFlows[0].amount , ' from ', outstandingPrincipal);
      outstandingPrincipal -= principalFlows[0].amount;
      principalFlows.shift();
      periodInterest = getInterestForPeriod(outstandingPrincipal, loan.interestRate, 1);
    }

    schedule.interests.push({
      principal: outstandingPrincipal,
      amount: periodInterest,
      date: nextDate
    });
    currentDate = nextDate;
    nextDate = _getNextInterestDate(loan, nextDate);
  }

  //console.log('Num Principal Flows ', principalFlows.length);
  /* Reduce principal with any outstanding unaccounted principal payments */
  while (principalFlows.length > 0 && principalFlows[0].date <= _addDays(currentDate, loan.leasePeriod)) {
    //console.log('Reducing 2 ', principalFlows[0].amount , ' from ', outstandingPrincipal);

    outstandingPrincipal -= principalFlows[0].amount;
    principalFlows.shift();
  }

  if (calcDate > currentDate) {
    schedule.accrued.amount = calculateInterest(outstandingPrincipal, loan.interestRate, loan.interestFrequency, currentDate, calcDate);
    schedule.accrued.principal = outstandingPrincipal;
  }
  schedule.outstandingPrincipal = outstandingPrincipal;

  if(loan.hasAmortization && loan.amortFrequency && loan.amortAmount) {
    outstandingPrincipal = loan.amount;
    currentDate = startDate;
    nextDate = _getNextPrincipalDate(loan, currentDate);
    while (nextDate <= calcDate && outstandingPrincipal > 0) {
      var amount = loan.amortAmount;
      if(outstandingPrincipal<loan.amortAmount){
        amount = outstandingPrincipal;
      }
      outstandingPrincipal -= amount;
      schedule.principals.push({
        principal: outstandingPrincipal,
        amount: amount,
        date: nextDate
      });
      currentDate = nextDate;
      nextDate = _getNextPrincipalDate(loan, nextDate);
    }  
  }

  return schedule;
}

function _prepareFlows(flows, type) {
  flows = flows || [];
  //console.log('Preparing ', type, ' from ', flows);
  flows.forEach(function (v) {
    if (typeof v.paymentDate === 'string') {
      v.paymentDate = new Date(v.paymentDate);
    }
  });
  
  return flows.filter(function (v) {
    return v[type];
  })
    .map(function(v){
      return {amount: v[type], date: v.paymentDate};
    })
    .sort(function (a, b) {
      return a.date > b.date? 1: (a.date < b.date ? -1 : 0) ;
    });
}

function _matchScheduleWithPayments(flows, payments) {
  //console.log('Incoming payments ', JSON.stringify(payments, null, 2));
  var overPayment = 0; /* Residue from previous additional payment */
  var overduePayment = 0;
  flows.forEach(function (item) {
    var outstanding = item.amount - overPayment;
    //console.log('Flow Item is ', item, overPayment, outstanding);

    if (outstanding > 0) {
      overPayment = 0;
      while (outstanding > 0 && payments.length > 0) {
        outstanding -= payments[0].amount;
        payments.shift();
        if (outstanding < 0) {
          overPayment = -outstanding;
          outstanding = 0;
        }
      }
      item.outstanding = outstanding;
    } else {
      item.outstanding = 0;
      overPayment = -outstanding;
    }
    if (item.outstanding === 0) {
      item.status = 'paid';
    } else if (item.outstanding < item.amount) {
      item.status = 'partial';
    } else {
      item.status = 'pending';
    }
    overduePayment += item.outstanding;
  });
  overduePayment -= overPayment;
  /* Apply any extra remaining payments to overdue */
  payments.forEach(function(payment){
    overduePayment -= payment.amount;
  });
  return {overdue: overduePayment};
}

function getAnalytics(loan, calcDate) {

  /* Prepare the loan for dates and payment sorting */
  if (typeof loan.startDate === 'string') {
    loan.startDate = new Date(loan.startDate);
  }

  var schedule = generateSchedule(loan, calcDate);

  /* Prepare the value-date data-type and sorted interest flows */
  var interestPayments = _prepareFlows(loan.payments, 'interest');
  var result = _matchScheduleWithPayments(schedule.interests, interestPayments);
  schedule.overdueInterest = result.overdue;
  //schedule.overPayment = result.overPayment;

  /* Prepare the value-date data-type and sorted interest flows */
  var principalPayments = _prepareFlows(loan.payments, 'principal');
  result = _matchScheduleWithPayments(schedule.principals, principalPayments);
  
  if(loan.hasAmortization){
    schedule.overduePrincipal = result.overdue;
  } else {
    schedule.overduePrincipal = 0;
  }
  //schedule.overPayment += result.overPayment;

  if (loan.payments && loan.payments.length > 0) {
    schedule.lastPayment = loan.payments.sort(function (a, b) {
      return a.date < b.date;
    })[0];
  }
  schedule.outstandingAmount = schedule.outstandingPrincipal + schedule.overdueInterest + schedule.accrued.amount /*- schedule.overPayment*/;
  return schedule;
}

module.exports = {
  roundAmount: roundAmount,
  stubApplicable: stubApplicable,
  calculateInterest: calculateInterest,
  getFullPeriodInterest: getFullPeriodInterest,
  generateSchedule: generateSchedule,
  getAnalytics: getAnalytics
};