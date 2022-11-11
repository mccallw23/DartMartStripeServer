import express from 'express';
import { Server } from "socket.io";
import { createServer } from "http";
import Stripe from 'stripe';
// import cors
import cors from 'cors';
import bodyParser from 'body-parser';


//import 'dotenv/config';
const app = express();
app.use(cors({
    origin: '*'
}));
app.use(bodyParser.json({limit: "50mb"}));
app.use(bodyParser.urlencoded({limit: "50mb", extended: true, parameterLimit:50000}));
app.use(express.json())
app.use(express.urlencoded({limit: "50mb", extended: true, parameterLimit:50000}));
app.use(bodyParser.raw({type: '*/*'}));
const port = process.env.PORT || 3000;
//const PUBLISHABLE_KEY = process.env.PUBLISHABLE_KEY;
const PUBLISHABLE_KEY_LIVE = process.env.PUBLISHABLE_KEY_LIVE;
const SECRET_KEY_LIVE = process.env.SECRET_KEY_LIVE;
//const SECRET_KEY = process.env.SECRET_KEY;
const stripe = new Stripe(
  "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",
  { apiVersion: "2020-08-27" }
);

var success = false;

const httpServer = createServer(app);
const io = new Server(httpServer, {});

io.on("connection", (socket) => {
  console.log("socket connected");
});

httpServer.listen(port, "0.0.0.0", () => {
    console.log(`Server is listening on port ${port}`);
    }
);
//payment route from stripe to get user id from stripe

const endpointSecret = "whsec_VWuchwdrks3eOEFhiByGIDGPc3p6SaN7";

app.get('/test', (req, res) => {
    res.send('Hello World!');
});


app.post('/webhook', express.raw({type: 'application/json'}), function(request, response) {
  const sig = request.headers['stripe-signature'];
  const body = request.body;
  //console.log("signature from the homies:", sig);
  //console.log("secret key from the homies", endpointSecret);

     let event = request.body;


  try {
    event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
  } catch (err) {
    // invalid signature
    response.status(400).end();
    return;
  }

  let intent = null;
  let success;
  switch (event['type']) {
    case 'payment_intent.succeeded':
      intent = event.data.object;
      console.log("Succeeded:", intent.id);
      success = true;
      break;
    case 'payment_intent.payment_failed':
      intent = event.data.object;
      const message = intent.last_payment_error && intent.last_payment_error.message;
      console.log('Failed:', intent.id, message);
      success = false;
      break;
  }

  response.json({success})



  //response.sendStatus(200);
});

app.post("/v1/customers", async (req, res) => {

   console.log(req.body);
    const customer = await stripe.customers.create({
        email: req.body.email,
        name: req.body.name,
    }
    );

    if (customer) {
      console.log(customer);
      res.json(customer);
    } else {
        res.status(400);
    }
});


app.post("/create-payment-intent", async (req, res) => {
    console.log(req.body.amount);
    
    try
    {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: req.body.amount, // subunits of the currency (USD)
            currency: 'usd',
            payment_method_types: ['card'],});
            const clientSecret = paymentIntent.client_secret;
            res.json({clientSecret});
    }
    catch(err)
    {
        res.json(err);
    }
});


app.post("/payment-success", async (req, res) => {
    res.json({success})
})

app.post('/payment-sheet', async (req, res) => {
  // Use an existing Customer ID if this is a returning customer.
  const customer = await stripe.customers.retrieve(req.body.stripeId);
  const ephemeralKey = await stripe.ephemeralKeys.create(
    {customer: customer.id},
    {apiVersion: '2020-08-27'}
  );
  const paymentIntent = await stripe.paymentIntents.create({
    amount: req.body.amount,
    currency: 'usd',
    customer: customer.id,
    automatic_payment_methods: {
      enabled: true,
    },
  });
  console.log('ephemeral key', ephemeralKey);
  res.json({
    paymentIntent: paymentIntent.client_secret,
    ephemeralKey: ephemeralKey.secret,
    customer: customer.id,
    publishableKey:
      "pk_live_51L2ihZH8XcWRx3ZXuYOM0SnCIwwlymCXKouDJrEPeBoWDN1D87IJ1yMWmRZENpoPwQpBLLG4B2I7Ax10NozfO3Hr00OJkBHJuz",
  });
});

// This is your Stripe CLI webhook secret for testing your endpoint locally.
app.post('/webhook', express.raw({type: 'application/json'}), (request, response) => {
  const sig = request.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
  } catch (err) {
    response.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }
  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      success = true;
      console.log(`💰 Payment received!, ${paymentIntent.id}`);
      break;
    // ... handle other event types
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  response.send();
});

app.listen(4242, () => console.log('Running on port 4242'));




