const SlackOff = require('./slack-off.js');

// provide this combination of real data to log in
// this particular example is untested but assumed to be invalid
const config = {
    team: 'slack',
    email: 'noreply@slack.com',
    password: 'password!!!!!!!',
};

// or you can supply a token; maybe you would save it after a successful log in
// const config = {
//     api_token: 'xoxs-bruh'
// };

const slackOff = new SlackOff(config);
(async ()=>{
    // log in to slack
    await slackOff.start();

    // get the token in case we want to cache it for next boot
    let token = slackOff.getApiToken();

    // listen to a channel
    await slackOff.listenToChannel('Getcetcetc', function (message){

        // Debug log to console
        console.log(message);

        if(message.text === 'bruh') {
            // Example reaction
            slackOff.web.reactions.add({
                channel: 'Getcetcetc',
                name: 'bruh',
                timestamp: message.ts
            });
        } else if(message.text.includes('Reminder: Stand Up!')) {
            // Example thread reply
            slackOff.web.chat.postMessage({
                channel: 'Getcetcetc',
                text: 'Yesterday I did various work on certain systems',
                thread_ts: message.ts
            });
        } else if(message.user !== 'Umemememe') { // don't infinite-loop
            // Example regular reply
            slackOff.web.chat.postMessage({
                channel: 'Getcetcetc',
                text: 'Wow, it sure is "' + message.text + '" around here'
            })
        }

    });

    setInterval(()=>{
        // keep the app alive since slack-off won't
        // and we don't have express or something running
    }, 1000);
})();