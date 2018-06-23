function _getNextDate(loan, current) {
  var nextDate = new Date(current.getTime());
  if (nextDate.getUTCDate() >= loan.interestDay) {
    nextDate.setUTCMonth(current.getUTCMonth() + 1);
  }
  nextDate.setUTCDate(loan.interestDay);
  return nextDate;
}

function _getDays(start, end) {
  return Math.floor((end - start) / (24 * 3600 * 1000));
}

function round(num) {
  //return Math.round( num * 100 + Number.EPSILON ) / 100;
  return Math.round(num);
}

function calculateInterest(loan, start, end) {
  var days = _getDays(start, end);
  var periodLength = loan.interestFrequency === 'Monthly' ? 30 : 360;
  return round(loan.amount * loan.interestRate * (days / periodLength) / 100);

}

function getFullPeriodInterest(loan) {
  return loan.amount * loan.interestRate / 100;
}

function stubApplicable(loan) {
  return (loan.startDate.getUTCDate() != loan.interestDay);
}

function generateSchedule(loan, calcDate) {
  var schedule = {
    interests: [],
    accrued: {
      value: 0,
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
  var currentDate = startDate;
  var nextDate = _getNextDate(loan, currentDate);

  if ((nextDate > startDate) && (nextDate < calcDate) && stubApplicable(loan)) {
    var interest = calculateInterest(loan, startDate, nextDate);
    schedule.interests.push({
      value: interest,
      date: nextDate
    });
    currentDate = nextDate;
    nextDate = _getNextDate(loan, nextDate);
  }
  var periodInterest = getFullPeriodInterest(loan);
  while (nextDate <= calcDate) {
    schedule.interests.push({
      value: periodInterest,
      date: nextDate
    });
    currentDate = nextDate;
    nextDate = _getNextDate(loan, nextDate);
  }

  if (calcDate > currentDate) {
    //console.log('Add End Stub');
    schedule.accrued.value = calculateInterest(loan, currentDate, calcDate);
  }

  return schedule;
}

module.exports = {
  round: round,
  stubApplicable: stubApplicable,
  calculateInterest: calculateInterest,
  getFullPeriodInterest: getFullPeriodInterest,
  generateSchedule: generateSchedule
};