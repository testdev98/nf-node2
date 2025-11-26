const axios = require('axios');

const getNiftyData = async () => {
    try {
        const response = await axios.get('https://www.nseindia.com/api/option-chain-indices?symbol=NIFTY', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching Nifty data:', error);
        return null;
    }
};

module.exports = {
    getNiftyData
};
