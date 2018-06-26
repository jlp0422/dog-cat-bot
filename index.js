/* eslint-disable */
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const request = require('request');
const config = require('config');
const images = require('./pics');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());


const port = process.env.PORT || 3000
app.listen(port, () => console.log(`port of call: ${port}`));

app.get('/', (req, res, next) => res.send('Hello'))

app.get('/webhook', (req, res, next) => {
  let VERIFY_TOKEN = 'GLAMSQUAD'

  let mode = req.query['hub.mode']
  let token = req.query['hub.verify_token']
  let challenge = req.query['hub.challenge']

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK VERIFIED')
      res.status(200).send(challenge)
    }
    else {
      res.sendStatus(403)
    }
  }
})

app.post('/webhook', (req, res, next) => {
  let body = req.body

  if (body.object === 'page') {
    body.entry.forEach(entry => {
      let webhook_event = entry.messaging[0]
      console.log('event: ', webhook_event)

      let sender_psid = webhook_event.sender.id;
      console.log('SENDER PSID: ', sender_psid);

      if (webhook_event.message) {
        handleMessage(sender_psid, webhook_event.message)
        // console.log('message: ', webhook_event.message)
      }
      else if (webhook_event.postback) {
        handlePostback(sender_psid, webhook_event.postback)
        // console.log('postback: ', webhook_event.postback)
      }
    })
    res.status(200).send('EVENT RECEIVED')
  }
  else {
    res.sendStatus(404)
  }
})

const handleMessage = (sender_psid, received_message) => {
  let response;
  if (received_message.text) {
    response = askTemplate()
  }
  callSendAPI(sender_psid, response)
}

const handlePostback = (sender_psid, received_postback) => {
  let response;
  let payload = received_postback.payload;
  if (payload === 'CAT_PICS') {
    response = ImageTemplate('cats', sender_psid)
    callSendAPI(sender_psid, response, function() {
      callSendAPI(sender_psid, askTemplate('Show me more'))
    })
  }
  else if (payload === 'DOG_PICS') {
    response = ImageTemplate('dogs', sender_psid)
    callSendAPI(sender_psid, response, function () {
      callSendAPI(sender_psid, askTemplate('Show me more'))
    })
  }
  else if (payload === 'GET_STARTED') {
    response = askTemplate('Are you a cat or dog person?');
    callSendAPI(sender_psid, response);
  }
}

const askTemplate = (text) => {
  return {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "button",
        "text": text,
        "buttons": [
          {
            "type": "postback",
            "title": "Cats",
            "payload": "CAT_PICS"
          },
          {
            "type": "postback",
            "title": "Dogs",
            "payload": "DOG_PICS"
          }
        ]
      }
    }
  }
}

const callSendAPI = (sender_psid, response, cb = null) => {
  // Construct the message body
  let request_body = {
    "recipient": {
      "id": sender_psid
    },
    "message": response
  };

  // Send the HTTP request to the Messenger Platform
  request({
    "uri": "https://graph.facebook.com/v2.6/me/messages",
    "qs": { "access_token": config.get('facebook.page.access_token') },
    "method": "POST",
    "json": request_body
  }, (err, res, body) => {
    if (!err) {
      if (cb) {
        cb();
      }
    } else {
      console.error("Unable to send message:" + err);
    }
  });
}

const ImageTemplate = (type, sender_id) => {
  return {
    "attachment": {
      "type": "image",
      "payload": {
        "url": getImage(type, sender_id),
        "is_reusable": true
      }
    }
  }
}

let users = {};

const getImage = (type, sender_id) => {
  // create user if doesn't exist
  if (users[sender_id] === undefined) {
    users = Object.assign({
      [sender_id]: {
        'cats_count': 0,
        'dogs_count': 0
      }
    }, users);
  }

  let count = images[type].length, // total available images by type
    user = users[sender_id], // // user requesting image
    user_type_count = user[type + '_count'];


  // update user before returning image
  let updated_user = {
    [sender_id]: Object.assign(user, {
      [type + '_count']: count === user_type_count + 1 ? 0 : user_type_count + 1
    })
  };
  // update users
  users = Object.assign(users, updated_user);

  console.log(users);
  return images[type][user_type_count];
}
