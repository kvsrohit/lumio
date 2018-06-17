"# lumio" 

## Loan Document Structure
``` JSON
{
  name: 'Nick Wurfle',
  amount: 20000,
  startDate: '2018-06-10T00:00:00.000Z',
  interestRate: 1.5,
  interestFrequency: 'Monthly/Annual'
  interestDay: 1,
  leasePeriod: 5,  
  hasPenalty: true,
  penaltyType:'FixedPerDay/InterestOnInterest',
  penaltyRate: 200
}
```

## Payment Document Structure
``` JSON
{
  loanId: 'Loan Document ID',
  amount: 250,
  paymentDate: '2018-06-10T00:00:00.000Z',
  type: 'Interest/Principal',
}
```

## Interest Calculations, Assuming No Principal Repayment
1. Pick the loan and past payments.
2. Arrange payments in ascending date order.
3. Calculate interest for 'start stub' (if present)
4. Calculate interest for each month till last month.
5. Calculate interest for 'end stub'. (Accrued Interest)
6. Cancel/Cross-out interest flow with interest paid back.
7. Identify outstanding Interest till last monthend.


