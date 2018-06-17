
var chai = require('chai');
chai.use(require('chai-things'));
var expect = chai.expect;

var Interest = require('../modules/interest');
describe('Interest Calculation', function () {
  this.timeout(20000);
  var loan;

  function dateAfter(input, days, month, year) {
    return new Date(Date.UTC(input.getUTCFullYear()+(year||0), input.getUTCMonth()+(month||0), input.getUTCDate()+(days||0)));
  }
  beforeEach('before', function (done) {
    loan = {
      amount: 20000,
      hasPenalty: false,
      interestDay: 1,
      interestFrequency: 'Monthly',
      interestRate: 2,
      leasePeriod: 5,
      name: 'Jack',
      penaltyRate: 0.01,
      penaltyType: 'Fixed Amount',
      startDate: new Date('2018-02-10T00:00:00.000Z')
    };
    done();
  });

  beforeEach('after', function (done) {
    return done();
  });

  it('stubApplicable: returns true when interest day is not start-day', function () {
    loan.interestDay = 11;
    expect(Interest.stubApplicable(loan)).to.be.true;
  });
  it('stubApplicable: returns false when interest day and start-day are same', function () {
    loan.interestDay = 10;
    expect(Interest.stubApplicable(loan)).to.be.false;
  });

  it('calculateInterest: returns 0 day\'s interest when start and end are same', function () {
    var start = new Date();
    var interest = Interest.calculateInterest(loan, start, start);
    expect(interest).to.equal(0);
  });

  it('calculateInterest: returns 7 day\'s interest', function () {
    var start = dateAfter(loan.startDate, 10);
    var end = dateAfter(start, 7);
    var interest = Interest.calculateInterest(loan, start, end);
    var expected = Interest.round(loan.amount * loan.interestRate * (7 / 30) / 100);
    expect(interest).to.equal(expected);
  });

  it('calculateInterest: Considers 360 as base when interest frequency is annual', function () {
    var start = dateAfter(loan.startDate, 10);
    var end = dateAfter(start, 58);
    loan.interestFrequency = 'Annual';
    var interest = Interest.calculateInterest(loan, start, end);
    var expected = Interest.round(loan.amount * loan.interestRate * (58 / 360) / 100);
    expect(interest).to.equal(expected);
  });


  it('getFullPeriodInterest: Calculates interest for period', function () {
    var interest = Interest.getFullPeriodInterest(loan);
    var expected = loan.amount * loan.interestRate / 100;
    expect(interest).to.equal(expected);
  });

  it('generateSchedule: Converts startDate to a Date type', function () {
    loan.startDate = '2018-02-10T00:00:00.000Z';
    expect(loan.startDate).to.be.a('string');
    Interest.generateSchedule(loan, new Date('2018-08-18T00:00:00.000Z'));
    expect(loan.startDate).to.be.a('date');
  });

  it('generateSchedule: No interest flows when calc-date is less than start date', function () {
    var calculationDate = loan.startDate;
    var schedule = Interest.generateSchedule(loan, calculationDate);
    expect(schedule).to.be.empty;
  });

  it('generateSchedule: generates start stub interest', function () {
    var calculationDate = new Date('2018-08-27T00:00:00.000Z');
    var schedule = Interest.generateSchedule(loan, calculationDate);
    expect(schedule).to.not.be.empty;
    expect(schedule.length).to.equal(6);
    expect(schedule[0].date).to.deep.equal(new Date('2018-03-01T00:00:00.000Z'));
    var expected = Interest.round(loan.amount * loan.interestRate * (19 / 30) / 100);
    expect(schedule[0].value).to.equal(expected);
  });
  
  it('generateSchedule: generates period interest', function () {
    var calculationDate = new Date('2018-08-27T00:00:00.000Z');
    var schedule = Interest.generateSchedule(loan, calculationDate);
    expect(schedule).to.not.be.empty;
    expect(schedule.length).to.equal(6);
    expect(schedule[1].date).to.deep.equal(new Date('2018-04-01T00:00:00.000Z'));
    var expected = Interest.round(loan.amount * loan.interestRate / 100);
    expect(schedule[1].value).to.equal(expected);
  });

  it('generateSchedule: generates end stub interest ', function () {
    var calculationDate = new Date('2018-08-27T00:00:00.000Z');
    var schedule = Interest.generateSchedule(loan, calculationDate, true);
    expect(schedule).to.not.be.empty;
    expect(schedule.length).to.equal(7);
    expect(schedule[schedule.length-1].date).to.deep.equal(new Date('2018-08-27T00:00:00.000Z'));
    var expected = Interest.round(loan.amount * loan.interestRate * (26 / 30) / 100);
    expect(schedule[schedule.length-1].value).to.equal(expected);
  });

  it('generateSchedule: generates correctly when interest payment date is different', function () {
    var calculationDate = new Date('2018-08-27T00:00:00.000Z');
    loan.interestDay = 18;
    var schedule = Interest.generateSchedule(loan, calculationDate, true);
    expect(schedule).to.not.be.empty;
    expect(schedule.length).to.equal(8);

    /* First Stub 10th - to - 18th Feb */
    expect(schedule[0].date).to.deep.equal(new Date('2018-02-18T00:00:00.000Z'));
    var expected = Interest.round(loan.amount * loan.interestRate * (8 / 30) / 100);
    expect(schedule[0].value).to.equal(expected);

    /* Period Interest */
    expect(schedule[1].date).to.deep.equal(new Date('2018-03-18T00:00:00.000Z'));
    expected = Interest.round(loan.amount * loan.interestRate / 100);

    /* End Stub 18th - to - 27th Aug */
    expect(schedule[schedule.length-1].date).to.deep.equal(new Date('2018-08-27T00:00:00.000Z'));
    expected = Interest.round(loan.amount * loan.interestRate * (9 / 30) / 100);
    expect(schedule[schedule.length-1].value).to.equal(expected);
  });

  it('generateSchedule: generates correctly on interest payment date', function () {
    var calculationDate = new Date('2018-08-18T00:00:00.000Z');
    loan.interestDay = 18;
    var schedule = Interest.generateSchedule(loan, calculationDate, true);
    expect(schedule).to.not.be.empty;
    expect(schedule.length).to.equal(7);
    expect(schedule[schedule.length-1].date).to.deep.equal(new Date('2018-08-18T00:00:00.000Z'));
    var expected = Interest.round(loan.amount * loan.interestRate / 100);
    expect(schedule[schedule.length-1].value).to.equal(expected);
  });

});