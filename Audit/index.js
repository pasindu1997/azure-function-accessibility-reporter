const { AxePuppeteer } = require('@axe-core/puppeteer');
const puppeteer = require('puppeteer');
const isReachable = require('is-reachable');
const URL = require("url").URL;

module.exports = async function (context, req) {

    const urlToCheck = req.query.url;

    if(!urlToCheck) {
        return context.res = {
            headers: {
                'Content-Type': 'application/json'
            },
            status: 400,
            body: {
                message: 'Please provide a URL to test.'
            },
        }
    }

    try {
        new URL(urlToCheck);
    } catch (err) {
        return context.res = {
            headers: {
                'Content-Type': 'application/json'
            },
            status: 400,
            body: {
                message: 'Please provide a valid URL.'
            },
        };
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
            },
        };
    }
    
    const browser = await puppeteer.launch({
        headless: true,
        'args' : [
            '--window-size=1920,1080',
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ]
    });
    
    const page = await browser.newPage();
    await page.setBypassCSP(true);
    await page.goto(urlToCheck, {waitUntil: 'load', timeout: 10000});

    const results = await new AxePuppeteer(page).analyze();
    
    await page.close();
    await browser.close();

    if(results) {
        return context.res = {
            headers: {
                'Content-Type': 'application/json'
            },
            status: 200,
            body: results,
        };
    } else {
        return context.res = {
            headers: {
                'Content-Type': 'application/json'
            },
            status: 500,
            body: {
                message: 'An error has occurred. Please try again.'
            },
        };
    }

}