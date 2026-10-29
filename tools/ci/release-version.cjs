function releaseVersion(date, runNumber) {
  const number = Number(runNumber);
  if (!Number.isInteger(number) || number < 1 || number > 9999) {
    throw Error('Release workflow run number must fit 0001–9999.');
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const part = name => parts.find(item => item.type === name).value;
  return `${part('year')}.${part('month')}.${part('day')}.${String(number).padStart(4, '0')}`;
}
module.exports = { releaseVersion };
