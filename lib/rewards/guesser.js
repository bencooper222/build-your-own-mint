const cards = Object.values(require('./cards')).reduce((acc, el) => {
  acc[el.plaidName] = el.returnPercent;
  return acc;
}, {});

console.log(cards);
exports.guesser = transaction => {
  if (cards[transaction.account] != null) {
    return cards[transaction.account](transaction);
  } else {
    // default behavior should be improved
    if (transaction.type === 'special') return 0;
    if (transaction.category.indexOf('Transfer') === -1) return 0;

    // 1% is a pretty normal rate on credit cards.
    // This will mostly mess up when it comes to debit card transactions that are wrong
    return 0.01;
  }
};
