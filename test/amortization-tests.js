var chai = require('chai');
chai.use(require('chai-things'));
var expect = chai.expect;

var Interest = require('../modules/interest');

describe('With Amortization', function () {
  var loan;

  function dateAfter(input, days, month, year) {
    return new Date(Date.UTC(input.getUTCFullYear() + (year || 0), input.getUTCMonth() + (month || 0), input.getUTCDate() + (days || 0)));
  }
  beforeEach('before', function (done) {
    loan = {
      amount: 20000,
      hasPenalty: false,
      paymentDay: 1,
      interestFrequency: 'Monthly',
      interestRate: 2,
      leasePeriod: 5,
      name: 'Jack',
      penaltyRate: 0.01,
      penaltyType: 'Fixed Amount',
      startDate: new Date('2018-02-10T00:00:00.000Z'),
      hasAmortization: true,
      amortFrequency: 'Quarterly',
      amortAmount: 8000
    };
    done();
  });

  beforeEach('after', function (done) {
    return done();
  });

  it('generateSchedule: No interest/amort flows when calc-date is less than start date', function () {
    var calculationDate = loan.startDate;
    var schedule = Interest.generateSchedule(loan, calculationDate);
    expect(schedule).to.be.ok;
    expect(schedule.interests).to.be.empty;
    expect(schedule.principals).to.be.empty;
  });

  it('generateSchedule: generates principal amortization flow', function(){
    var calculationDate = new Date('2018-08-27T00:00:00.000Z');
    var schedule = Interest.generateSchedule(loan, calculationDate);
    expect(schedule).to.be.ok;
    expect(schedule.principals).to.be.an('array').of.length(2);

    expect(schedule.principals[0].date).to.deep.equal(new Date('2018-05-01T00:00:00.000Z'));
    expect(schedule.principals[0].amount).to.equal(loan.amortAmount);
    
    expect(schedule.principals[1].date).to.deep.equal(new Date('2018-08-01T00:00:00.000Z'));
    expect(schedule.principals[1].amount).to.equal(loan.amortAmount);
  });

  it('generateSchedule: considers only remaining amount for last amortization', function(){
    var calculationDate = new Date('2018-12-27T00:00:00.000Z');
    var schedule = Interest.generateSchedule(loan, calculationDate);
    expect(schedule).to.be.ok;
    expect(schedule.principals).to.be.an('array').of.length(3);

    expect(schedule.principals[0].date).to.deep.equal(new Date('2018-05-01T00:00:00.000Z'));
    expect(schedule.principals[0].amount).to.equal(loan.amortAmount);
    
    expect(schedule.principals[1].date).to.deep.equal(new Date('2018-08-01T00:00:00.000Z'));
    expect(schedule.principals[1].amount).to.equal(loan.amortAmount);

    expect(schedule.principals[2].date).to.deep.equal(new Date('2018-11-01T00:00:00.000Z'));
    expect(schedule.principals[2].amount).to.equal(4000);
  });

  it('getAnalytics: applies the interest & principal-payments correctly', function () {
    var calculationDate = new Date('2018-07-18T00:00:00.000Z');
    loan.payments = [{
      date: new Date('2018-04-04T00:00:00.000Z'),
      interest: 300
    }, {
      date: new Date('2018-05-11T00:00:00.000Z'),
      interest: 400,
      principal: 8000
    }, {
      date: new Date('2018-06-28T00:00:00.000Z'),
      interest: 450,
      principal: 4000
    }, {
      date: new Date('2018-06-28T00:00:00.000Z'),
      interest: 500
    }];
    var schedule = Interest.getAnalytics(loan, calculationDate);

    /* No Amortization : No pricipal flows generated */
    expect(schedule.principals).to.be.an('array').of.length(1);

    /* No principal repayments */
    expect(schedule.outstandingPrincipal).to.equal(8000);

    /* Starting 10-feb to calc-date 18 July */

    /* feb-stub, march, apr, may, jun */
    expect(schedule.interests).to.be.an('array').of.length(5);

    /* Initial stub interest 19 days */
    expect(schedule.interests[0].principal).to.equal(20000);
    expect(schedule.interests[0].amount).to.equal(253);
    expect(schedule.interests[0].status).to.equal('paid');

    /* Mar, Apr, May fully paid */
    expect(schedule.interests[1].amount).to.equal(400);
    expect(schedule.interests[1].status).to.equal('paid');
    expect(schedule.interests[2].amount).to.equal(400);
    expect(schedule.interests[2].status).to.equal('paid');
    expect(schedule.interests[3].amount).to.equal(400);
    expect(schedule.interests[3].status).to.equal('paid');
    expect(schedule.interests[3].principal).to.equal(20000);

    /* June partially paid on reduced principal */
    expect(schedule.interests[4].principal).to.equal(12000);
    expect(schedule.interests[4].amount).to.equal(240);
    expect(schedule.interests[4].outstanding).to.equal(43);
    expect(schedule.interests[4].status).to.equal('partial');

    /* July accrual 17 days on reduced principal 8000 (20k - 8k -4k) */
    expect(schedule.accrued.amount).to.equal(91);
  });
});