const { AxePuppeteer } = require('@axe-core/puppeteer');
const puppeteer = require('puppeteer');
const isReachable = require('is-reachable');
const URL = require("url").URL;
const zlib = require('zlib');
const fs = require('fs').promises;
const path = require('path');

module.exports = async function (context, req) {

    const urlToCheck = req.query.url;
    const language = req.query.language;

    const asyncGzip = async buffer => {
        return new Promise((resolve, reject) => {
          zlib.gzip(buffer, {}, (error, gzipped) => {
            if (error) {
              reject(error);
            }
            resolve(gzipped);
          })
        })
      }

    function jsonToBuffer(data) {
        return Buffer.from(JSON.stringify(data), 'utf-8');
    }

    async function getLocaleData() {
        try {
            const data = await fs.readFile(path.resolve(__dirname + '/locales/' + language + '.json'), 'utf8');
            return JSON.parse(data);
        } catch(error) {
            return null;
        }  
    }

    if(!urlToCheck) {
        return context.res = {
            headers: {
                'Content-Type': 'application/json'
            },
            status: 400,
            body: {
                message: 'Please provide a URL to test.'
            }
        }
    }

    try {
        new URL(urlToCheck);
    } catch (error) {
        return context.res = {
            headers: {
                'Content-Type': 'application/json'
            },
            status: 400,
            body: {
                message: 'Please provide a valid URL.'
            }
        }
    }

    const canBeReached = await isReachable(urlToCheck);
    if(!canBeReached) {
        return context.res = {
            headers: {
                'Content-Type': 'application/json'
            },
            status: 400,
            body: {
                message: 'Unable to reach URL.'
            }
        }
    }

    const browser = await puppeteer.launch({
        headless: true,
        'args' : [
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--disable-setuid-sandbox',
            '--no-first-run',
            '--no-sandbox',
            '--no-zygote',
            '--single-process'
        ]
    });
    
    const page = await browser.newPage();
    await page.setBypassCSP(true);

    try {
        
        await page.goto(urlToCheck, {timeout: 10000});

        let axeOptions = {
            resultTypes: [
            'violations', 
            'passes',
            'incomplete'
            ]
        }

        let axeConfiguration = {};
        if(language) {
            const localeData = await getLocaleData();
            if(localeData) {
                axeConfiguration.locale = localeData;
            }         
        }

        const results = await new AxePuppeteer(page).configure(axeConfiguration).options(axeOptions).analyze();
        
        await page.close();
        await browser.close();

        if(results) {
            const gzippedBuffer = await asyncGzip(jsonToBuffer(results));   
            context.res.headers = {
                'Content-Type': 'application/json',
                'Content-Encoding': 'gzip'
            };
            context.res.status = 200;
            context.res.body = gzippedBuffer;
            return context.res;

        } else {
            return context.res = {
                headers: {
                    'Content-Type': 'application/json'
                },
                status: 500,
                body: {
                    message: 'An error has occurred. Please try again.'
                }
            }
        }
    } catch(error) {
        return context.res = {
            headers: {
                'Content-Type': 'application/json'
            },
            status: 500,
            body: {
                message: error.message
            }
        }
    }

}