const request = require("request");
const fs = require("fs");
const URL = require("url").URL;

const delay = async ms => new Promise((resolve,reject) => setTimeout(resolve, ms));

const getISOStringDate = (year, month, day) => new Date(Date.UTC(year, month, day)).toISOString();

const makeGetQueryString = (start, end) => `start=${start}&end=${end}`;

const BASE_URL="https://api.coinpaprika.com/v1/coins";

const getCoinOhlcvHistoricalUrl = ticker => `${BASE_URL}/${ticker}/ohlcv/historical`

const getUrlForHalfYear = (ticker, year, month) => {
    var url = new URL(getCoinOhlcvHistoricalUrl(ticker));
    url.search = makeGetQueryString(getISOStringDate(year,month,1), getISOStringDate(year,month+6,0));
    return url;
}
const getUrlForJanJun = (ticker, year) => getUrlForHalfYear(ticker, year, 0);
const getUrlForJulDec = (ticker, year) => getUrlForHalfYear(ticker, year, 6);

const requestJson = async url => new Promise(async (resolve,reject) => {
    await delay(120);
    request({url}, (err,resp, body) => {
        if (err) {
            console.err(err);
            return resolve([]);
        }
        return resolve(JSON.parse(body));
    })
})
const writeJsonFile = (filename, json) => fs.writeFile(`${filename}.json`, JSON.stringify(json, null, 2), () => {});

const yearFromIsoString = (isoString) => new Date(isoString).getFullYear();

class AnnualData {
    constructor(year, ticker) {
        this.year = year;
        this.ticker = ticker;
    }
    async fetchData() {
        try {
            var firsthalf = await requestJson(getUrlForJanJun(this.ticker, this.year));
            var secondhalf = await requestJson(getUrlForJulDec(this.ticker,this.year));
            this.data = [...firsthalf, ...secondhalf];
            console.log(`Got ${this.ticker} data for ${this.year}. Data length is ${this.data.length}.`);// First element is ${JSON.stringify(this.data[0])}, last element is ${JSON.stringify(this.data[this.data.length-1])}`)
            return this;
        } catch (e) {
            console.log(e)
        }
    }
    persist() {
        if (this.data && this.data.length)
            writeJsonFile(`data/${this.ticker}-${this.year}-ohlcv`, this.data);
    }
}

const fetchTickerDataForYears = (ticker, years) => {
    return years.map( year => new AnnualData(year, ticker) )
    .reduce( (promise, annualData) => {
        return promise
        .then(annualData.fetchData.bind(annualData))
        .then(annualData.persist.bind(annualData))
        .then(() => promise) // its already resolved but we need to get the data to do cummulative return with all data
        .then(cummulative => [...cummulative,...annualData.data] )
    }, Promise.resolve([]) )
    .then(data => {
        let yearStart = yearFromIsoString(data[0].time_open);
        let yearEnd = yearFromIsoString(data[data.length-1].time_open);
        writeJsonFile(`data/${ticker}-${yearStart}-${yearEnd}-ohlcv`, data)
    })
}
const TICKERS = ['eth-ethereum', 'btc-bitcoin', 'ltc-litecoin'];
const YEARS=[2013,2014,2015,2016,2017,2018,2019];

(async () => {
    for (var ticker of TICKERS)
        await fetchTickerDataForYears(ticker, YEARS)
})()
