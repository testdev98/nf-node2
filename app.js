const express = require("express");
const exphbs = require("express-handlebars");
const path = require("path");

const app = express();
const port = 3000;

app.engine(
  "hbs",
  exphbs.engine({
    extname: ".hbs",
    defaultLayout: false,
    partialsDir: path.join(__dirname, "views/partials"),
  })
);

app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

const api = require("./utils/api");

app.get("/", async (req, res) => {
  const niftyData = await api.getNiftyData();
  const processedData = processData(niftyData);
  res.render("index", {
    title: "",
    data: processedData.filteredData,
    totals: processedData.totals,
    pcr: processedData.pcr,
    support: processedData.support,
    resistance: processedData.resistance,
    marketData: processedData.marketData,
  });
});

app.get("/data", async (req, res) => {
  const niftyData = await api.getNiftyData();
  const processedData = processData(niftyData);
  res.render("partials/option-chain-table", {
    layout: false,
    data: processedData.filteredData,
    totals: processedData.totals,
    pcr: processedData.pcr,
    support: processedData.support,
    resistance: processedData.resistance,
    marketData: processedData.marketData,
  });
});

const processData = (data) => {
  if (!data || !data.records || !data.records.data) {
    return {
      filteredData: [],
      totals: {},
    };
  }
  // Filter items with both CE and PE, and remove duplicates by strike price
  const seenStrikes = new Set();
  const allData = data.records.data
    .filter((item) => item.CE && item.PE)
    .filter((item) => {
      if (seenStrikes.has(item.strikePrice)) {
        return false;
      }
      seenStrikes.add(item.strikePrice);
      return true;
    });
  const underlyingValue = data.records.underlyingValue;

  let closestStrike = 0;
  let minDifference = Number.MAX_VALUE;
  allData.forEach((item) => {
    const difference = Math.abs(item.strikePrice - underlyingValue);
    if (difference < minDifference) {
      minDifference = difference;
      closestStrike = item.strikePrice;
    }
  });

  const closestStrikeIndex = allData.findIndex(
    (item) => item.strikePrice === closestStrike
  );

  const startIndex = Math.max(0, closestStrikeIndex - 8);
  const endIndex = Math.min(allData.length, closestStrikeIndex + 9);

  const filteredData = allData.slice(startIndex, endIndex);

  const highestCallOI = Math.max(...filteredData.map((d) => d.CE.openInterest));
  const highestCallChangeOI = Math.max(
    ...filteredData.map((d) => d.CE.changeinOpenInterest)
  );
  const highestPutOI = Math.max(...filteredData.map((d) => d.PE.openInterest));
  const highestPutChangeOI = Math.max(
    ...filteredData.map((d) => d.PE.changeinOpenInterest)
  );

  const enhancedData = filteredData.map((item) => ({
    ...item,
    isCurrentStrike: item.strikePrice === closestStrike,
    CE: {
      ...item.CE,
      isHighestOI: item.CE.openInterest === highestCallOI,
      isHighestChangeOI: item.CE.changeinOpenInterest === highestCallChangeOI,
    },
    PE: {
      ...item.PE,
      isHighestOI: item.PE.openInterest === highestPutOI,
      isHighestChangeOI: item.PE.changeinOpenInterest === highestPutChangeOI,
    },
  }));

  const totals = {
    callOI: filteredData.reduce((acc, curr) => acc + curr.CE.openInterest, 0),
    callChangeOI: filteredData.reduce(
      (acc, curr) => acc + curr.CE.changeinOpenInterest,
      0
    ),
    putOI: filteredData.reduce((acc, curr) => acc + curr.PE.openInterest, 0),
    putChangeOI: filteredData.reduce(
      (acc, curr) => acc + curr.PE.changeinOpenInterest,
      0
    ),
  };

  // Calculate PCR (Put-Call Ratio) = Total PUT OI / Total CALL OI
  const pcr = totals.callOI > 0 ? (totals.putOI / totals.callOI).toFixed(2) : "N/A";

  // Calculate Support and Resistance
  // Step 1: Find highest OI from both sides
  const highestCallOIItem = filteredData.find(
    (item) => item.CE.openInterest === highestCallOI
  );
  const highestPutOIItem = filteredData.find(
    (item) => item.PE.openInterest === highestPutOI
  );

  // Step 2 & 3: Calculate support and resistance
  let support = null;
  let resistance = null;

  if (highestPutOIItem) {
    // Support = Strike Price - Put LTP
    support = highestPutOIItem.strikePrice - highestPutOIItem.PE.lastPrice;
  }

  if (highestCallOIItem) {
    // Resistance = Strike Price + Call LTP
    resistance = highestCallOIItem.strikePrice + highestCallOIItem.CE.lastPrice;
  }

  // Get market data
  const marketData = {
    currentPrice: underlyingValue,
    open: data.records.strikePrices?.[0] || underlyingValue,
    high: data.records.strikePrices?.[data.records.strikePrices.length - 1] || underlyingValue,
    prevClose: data.records.strikePrices?.[Math.floor(data.records.strikePrices.length / 2)] || underlyingValue,
  };

  return {
    filteredData: enhancedData,
    totals,
    pcr,
    support: support ? support.toFixed(2) : "N/A",
    resistance: resistance ? resistance.toFixed(2) : "N/A",
    marketData,
  };
};

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
