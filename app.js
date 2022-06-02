try {

require('dotenv').config()
const data = require('./quotes.json');

// Telegraf
const { Telegraf } = require('telegraf');
const bot = new Telegraf(process.env.BOT_TOKEN);

// MongoDB
const { MongoClient } = require('mongodb');
const uri = process.env.URI;
const client = new MongoClient(uri);

// Listen only for Heroku deployment
const port = process.env.PORT || 3000;
var http = require('http');
//create a server object:
http.createServer(function (req, res) {
  res.write('Hello World!'); //write a response
  res.end(); //end the response
}).listen(port, function(){
 console.log(`server start at port ${port}`); //the server object listens on port 3000
});

async function getQuotes(ctx) {
  const result = await client.db("telegramUsers").collection("users").findOne({
    name: ctx.from.first_name,
    telegram_user_id: ctx.from.id
  })
  const quotes = result.quotes;
  return quotes;
}

// method that send quote
async function sendQuote(ctx) {
  const quotes = await getQuotes(ctx);
  bot.telegram.sendMessage(ctx.chat.id, quotes[Math.trunc(Math.random() * quotes.length)], {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "More!",
            callback_data: 'my_quote'
          }
        ],
      ]
    }
  })
}

function sendHelpMessage(ctx) {
  bot.telegram.sendMessage(ctx.chat.id,
    `
    Hello there! I am Motiv bot.
    ╮ (. ❛ ᴗ ❛.) ╭
I save your favourite quotes and get them randomly for encouragement. 
You can get some inspirational quotes from me too!

Commands available:
save - Save a quote into your collection
quote - Get one of your quotes
random - Get random quote or photo from me
list - List all your quotes
delete - Delete a quote based on index on list
help - Get the bot manual
    `)
}

async function main() {
  try {
    await client.connect();
    console.log('connected')
  } catch (e) {
    console.error(e);
  } finally {
    // await client.close();
  }

  bot.command('/start', ctx => {
    sendHelpMessage(ctx)
  })
  bot.command('/help', ctx => {
    sendHelpMessage(ctx)
  })

  bot.command('/quote', sendQuote)
  bot.action('my_quote', sendQuote)


  bot.command('/list', async ctx => {
    const quotes = await getQuotes(ctx);
    if (quotes.length === 0) ctx.reply("Your have no quote \n¯\\_(ツ)_/¯\nAdd one!")
    ctx.reply(quotes.map((quote, idx) => `${idx + 1}. ${quote}`).join("\n"))
  })

  bot.command('/save', async ctx => {
    if (ctx.update.message.text.substring(6).trim() === "") {
      ctx.reply("I think empty quote is not motivating \nಠ_ಠ")
      return
    }
    // update one doc
    const users = client.db("telegramUsers").collection("users");
    // create a filter for a movie to update
    const filter = { telegram_user_id: ctx.from.id, name: ctx.from.first_name };
    // this option instructs the method to create a document if no documents match the filter
    const options = { upsert: true };
    // create a document that sets the plot of the movie
    const updateDoc = {
      $push: {
        // quotes: ctx.message
        quotes: ctx.update.message.text.substring(6)
      },
    };
    const result = await users.updateOne(filter, updateDoc, options);
    console.log('result', result);
    if(result.modifiedCount === 1){
      ctx.reply("Your quote is saved \n└(^o^ )Ｘ( ^o^)┘")
    }
  })

  bot.command("/delete", async ctx => {
    const quotes = await getQuotes(ctx);
    if (quotes.length === 0) {
      ctx.reply("Your have no quote \n¯\\_(ツ)_/¯\nAdd one!");
      return;
    }
    
    const indexStr = ctx.update.message.text.substring(8);
    const index = parseInt(indexStr);
    if (Number.isNaN(index)) {
      ctx.reply("Please provide a number \n(╯°□°）╯︵ ┻━┻");
      return;
    }
    if (index <= 0 || index > quotes.length) {
      ctx.reply("The index chosen is not within the range of 1 to " + quotes.length + " \nノ) (ﾉಥ益ಥ）ﾉ ︵┻━┻");
      return;
    }
    const quote = quotes[index - 1]
    quotes.splice(index - 1, 1)
    // Delete operation
    const users = client.db("telegramUsers").collection("users");
    // create a filter for a movie to update
    const filter = { telegram_user_id: ctx.from.id, name: ctx.from.first_name };
    // create a document that sets the plot of the movie
    const updateDoc = {
      $set: {
        quotes: quotes
      },
    };
    const result = await users.updateOne(filter, updateDoc);
    console.log('result', result);
    ctx.reply(`The quote "${quote}" is deleted... \n(▀̿Ĺ̯▀̿ ̿)`)
  })

  //method that displays the inline keyboard buttons 
  bot.command('/random', ctx => {
    let message = `Great, would you like a random quote or a random photo?`;
    bot.telegram.sendMessage(ctx.chat.id, message, {
      reply_markup: {
        inline_keyboard: [
          [{
            text: "Quote",
            callback_data: 'random_quote'
          },
          {
            text: "Photo",
            callback_data: 'random_photo'
          }
          ],
        ]
      }
    })
  })

  //method that returns random quote
  bot.action('random_quote', (ctx) => {
    const quote = data.quotes[Math.trunc(Math.random() * data.quotes.length)];
    ctx.reply(quote);
    bot.telegram.answerCbQuery(ctx.callbackQuery.id);
  })
  //method that returns random photo
  const randomPhoto = 'https://picsum.photos/300/300/?random'
  bot.action('random_photo', (ctx) => {
    ctx.replyWithPhoto({ url: randomPhoto });
    bot.telegram.answerCbQuery(ctx.callbackQuery.id);
  })

  //method to start get the script to pulling updates for telegram 
  bot.launch();

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'))
  process.once('SIGTERM', () => bot.stop('SIGTERM'))
}

main().catch(err => console.log('App crashed: ' + err))


} catch (error) {
  console.log('error in big try-catch:')
  console.log(error)
}