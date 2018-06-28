function _getNextDate(loan, current) {
  var nextDate = new Date(current.getTime());
  if (nextDate.getUTCDate() >= loan.interestDay) {
    nextDate.setUTCMonth(current.getUTCMonth() + 1);
  }
  nextDate.setUTCDate(loan.interestDay);
  return nextDate;
}

function _addDays(start, n) {
  //var ret = new Date(start.getTime());
  //ret.setUTCDate(ret.getUTCDate()+n);
  return new Date(start.getTime()+(n*24*3600*1000));
}

function _getDays(start, end) {
  return Math.floor((end - start) / (24 * 3600 * 1000));
}

function round(num) {
  //return Math.round( num * 100 + Number.EPSILON ) / 100;
  return Math.round(num);
}

function calculateInterestForLoan(loan, start, end){
  return calculateInterest(loan.amount, loan.interestRate, loan.interestFrequency, start, end);
}

function calculateInterest(amount, rate, frequency, start, end) {
  var days = _getDays(start, end);
  var periodLength = frequency === 'Monthly' ? 30 : 360;
  return getInterestForPeriod(amount, rate, days/periodLength);
}

function getInterestForPeriod(amount, rate, period) {
  return round(amount * rate * period / 100);
}

function getFullPeriodInterest(loan) {
  return getInterestForPeriod(loan.amount, loan.interestRate, 1);
}

function stubApplicable(loan) {
  return (loan.startDate.getUTCDate() != loan.interestDay);
}

function generateSchedule(loan, calcDate) {

  var schedule = {
    interests: [],
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
  loan.interestDay = loan.interestDay || startDate.getUTCDate();

  var outstandingPrincipal = loan.amount;
  var principalFlows = loan.principalFlows?loan.principalFlows.slice():[];

  var currentDate = startDate;
  var nextDate = _getNextDate(loan, currentDate);

  if ((nextDate > startDate) && (nextDate < calcDate) && stubApplicable(loan)) {
    var interest = calculateInterest(outstandingPrincipal, loan.interestRate, loan.interestFrequency, startDate, nextDate);
    schedule.interests.push({
      principal: outstandingPrincipal,
      amount: interest,
      date: nextDate
    });
    currentDate = nextDate;
    nextDate = _getNextDate(loan, nextDate);
  }
  var periodInterest = getInterestForPeriod(outstandingPrincipal, loan.interestRate, 1);
  while (nextDate <= calcDate) {

    while(principalFlows.length>0 && principalFlows[0].date < _addDays(currentDate, loan.leasePeriod)){
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
    nextDate = _getNextDate(loan, nextDate);
  }

  if (calcDate > currentDate) {
    //console.log('Add End Stub');
    schedule.accrued.amount = calculateInterest(outstandingPrincipal, loan.interestRate, loan.interestFrequency, currentDate, calcDate);
    schedule.accrued.principal = outstandingPrincipal;
  }
  schedule.outstandingPrincipal = outstandingPrincipal;
  return schedule;
}

function _prepareFlows(flows){
  flows = flows || [];
  flows.forEach(function(v) {
    if(typeof v.date === 'string'){
      v.date = new Date(v.date);
    }
  });
  flows.sort(function(a, b){
    return a.date > b.date;
  });
  return flows;
}

function getAnalytics(loan, calcDate) {

  /* Prepare the loan for dates and payment sorting */
  if (typeof loan.startDate === 'string') {
    loan.startDate = new Date(loan.startDate);
  }
  /* Prepare the value-date data-type and sort the principal flows */
  loan.principalFlows = _prepareFlows(loan.principalFlows);
  loan.interestFlows = _prepareFlows(loan.interestFlows);
  
  var schedule = generateSchedule(loan, calcDate);
  var interestFlows = loan.interestFlows.slice();
  var overPayment = 0; /* Residue from previous additional payment */
  schedule.outstandingInterest = 0;
  schedule.interests.forEach(function(item) {
    item.status = 'pending';
    var outstanding = item.amount-overPayment;

    if(outstanding>0){
      overPayment = 0;
      while(outstanding>0 && interestFlows.length>0){
        item.status = 'partial';
        outstanding -= interestFlows[0].amount;
        interestFlows.shift();
        if(outstanding<0) {
          overPayment = -outstanding;
          outstanding = 0;
          item.status = 'paid';
        }
      }
      item.outstanding = outstanding;
    } else {
      item.outstanding = 0;
      item.status = 'paid';
      overPayment = -outstanding;
    }
    schedule.outstandingInterest += item.outstanding;
  });
  schedule.overPayment = overPayment;
  schedule.outstandingAmount = schedule.outstandingPrincipal + schedule.outstandingInterest - schedule.overPayment;
  return schedule;
}




module.exports = {
  round: round,
  stubApplicable: stubApplicable,
  calculateInterest: calculateInterest,
  getFullPeriodInterest: getFullPeriodInterest,
  generateSchedule: generateSchedule,
  getAnalytics: getAnalytics
};