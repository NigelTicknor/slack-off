const request = require('request-promise-native');
const Zombie = require('zombie');
const WebClient = require('@slack/web-api').WebClient;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.132 Safari/537.36	';

class SlackOff {
	
	constructor(config) {

		// App internal use
		this.apiToken = null;
		this.cacheChannelHistory = [];
		this.intervals = [];


		// Required inputs
		if(config.api_token) {
			this.apiToken = config.api_token;
		}

		if(config.team && config.email && config.password) {
			this.team = config.team;
			this.email = config.email;
			this.password = config.password;
		} else if (!config.api_token) {
			throw new Error('team, email, and password OR api_token must be supplied.');
		}


		// Configurables with defaults
		this.ua = config.ua || UA;
		this.jar = config.jar || request.jar();
		this.intervalMessagePolling = config.intervalMessagePolling || 10000;

	}

	/**
	 * Get the Slack url
	 * @param endpoint
	 * @returns {string}
	 */
	buildSlackUrl(endpoint = '/') {
		return 'https://' + this.team + '.slack.com' + endpoint;
	}

	/**
	 * Get headers for Request
	 * @returns object
	 */
	getHeaders() {
		return {
			'User-Agent': this.ua
		};
	}

	/**
	 * Get the API Token
	 * @returns {null|string}
	 */
	getApiToken() {
		//todo something about if the token fails, re-authenticate
		return this.apiToken;
	}

	/**
	 * Sort slack messages based on ts
	 * @param a First Message
	 * @param b Second Message
	 * @returns {number}
	 */
	sortMessages(a,b) {
		return parseFloat(a.ts) - parseFloat(b.ts);
	}

	/**
	 * Exchange login info for a token
	 * @returns {Promise<void>}
	 */
	async exchangeLoginInfoForToken()
	{
		if(!this.team || !this.email || !this.password) {
			throw new Error('API Token expired but fallback auth info was not provided.');
		}

		console.log('Need to log in....');
		let browser = new Zombie({userAgent: UA, debug: false, silent: true});
		
		console.log('Fetching slack page...');
		await new Promise((resolve) => { // wrap promise to "avoid" callback
			browser.visit(this.buildSlackUrl(), () => {
				resolve();
			})
		});
		console.log('Searching for crumb...');
		const inputCrumb = browser.xpath('//input[@name="crumb"]');
		//todo add error handling
		const crumb = inputCrumb.iterateNext().value;
		browser.destroy();
		console.log('Got crumb!');

		console.log('Logging in...');
		const resp = await request.post({
			url: this.buildSlackUrl(),
			jar: this.jar,
			headers: this.getHeaders(),
			followAllRedirects: true,
			form: {
				signin: 1,
				redir: '',
				crumb: crumb,
				email: this.email,
				password: this.password,
				remember: 'on'
			}
		});
		//todo validate lol
		let loginConfig = JSON.parse(resp.match(/var boot_data = (.*);/m)[1]);
		this.apiToken = loginConfig.api_token;
		console.log('Logged in!');
	}

	/**
	 * Log in to slack and set up the app
	 * @returns {Promise<void>}
	 */
	async start() {

		if(this.getApiToken() === null) {
			await this.exchangeLoginInfoForToken();
		}

		this.web = new WebClient(this.getApiToken());

	}

	/**
	 *
	 * @param channelId
	 * @param callback
	 * @returns {Promise<void>}
	 */
	async listenToChannel(channelId, callback) {

		let mostRecentMessage = (await this.web.conversations.history({
			channel: channelId,
			limit: 1,
		})).messages;

		let ts = 0;

		// I'd imagine this would be 0 in a channel with no messages
		// todo test that ^
		if(mostRecentMessage.length > 0) {
			ts = mostRecentMessage[0].ts;
		}

		this.cacheChannelHistory[channelId] = ts;

		this.intervals[channelId] = setInterval(async ()=>{
			//todo add error handling
			let messages = await this.web.conversations.history({
				channel: channelId,
				oldest: this.cacheChannelHistory[channelId]
			});
			messages.messages.sort(this.sortMessages).forEach((e) => {
				this.cacheChannelHistory[channelId] = e.ts;
				callback(e);
			})
		}, this.intervalMessagePolling);
		this.intervals[channelId].unref(); // don't hang the program

	}

	/**
	 * Clear
	 * @param channelId
	 * @returns {Promise<void>}
	 */
	async stopListeningToChannel(channelId) {
		clearInterval(this.intervals[channelId]);
	}

}

module.exports = SlackOff;