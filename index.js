require('dotenv').config()

const TelegramBot = require('node-telegram-bot-api')
const nodeFetch = require('node-fetch')
const { createApi } = require('unsplash-js')

const debug = require('./debug')

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true })
const unsplash = createApi({
  accessKey: process.env.UNSPLASH_ASSECC_KEY,
  fetch: nodeFetch
})



const sendError = (chatId, text) => bot.sendMessage(chatId, text)

const sendDocument = async (chatId, url, userName, caption, messageText) => {
  try {
    bot.sendDocument(chatId, url, {
      caption: `<b>Source: ${userName}</b>\n<i>${caption}</i>`,
      parse_mode: 'HTML'
    })
  } catch (err) {
    sendError(chatId, `${messageText}, при отправке фото произошла ошибка, попробуйте снова: ${err.message}`)
  }
}

const sendStartFetchingPhoto = async chatId => {
  await bot.sendSticker(chatId, './assets/stickers/searching.tgs')
}

const getRandomPhoto = async (query) => {
  const res = await unsplash.photos.getRandom({ count: 1, query })
  if (res.errors) throw new Error(res.errors[0])
  return res.response[0]
}


const fetchPhoto = async (query, chatId, messageText) => {
  try {
    let result = {}
    result = await getRandomPhoto(query ? query : '')
    return result
  } catch (error) {
    sendError(chatId, `${messageText}, при получении фото произошла ошибка, попробуйте снова: ${error.message}`)
  }
}



// command handlers
bot.onText(/\/photo(\s.+)?/, async (msg, [source, match]) => {
  const { chat, text } = msg

  await sendStartFetchingPhoto(chat.id)

  const { description, alt_description, user, urls } = await fetchPhoto(match, chat.id, text)
  let caption = '', userName = ''

  if (description) caption += description
  else if (alt_description) caption += alt_description
  else caption = 'Description is empty'

  if (user.portfolio_url) userName += `<a href="${user.portfolio_url}">${user.username}</a>`
  else userName += user.username

  sendDocument(chat.id, urls.full, userName, caption)
})

bot.onText(/\/start/, msg => {
  bot.sendMessage(msg.chat.id, `Привет ${msg.chat.first_name}.`)
})


// inline handler
bot.on('inline_query', async query => {
  const result = []

  unsplash.search.getPhotos({
    query: query.query, page: 1, perPage: 20
  })
    .then(res => {
      const findResults = res.response.results
      if (findResults.length !== 0) {
        findResults.forEach(item => {
          result.push({
            type: 'photo',
            id: item.id,
            photo_url: item.urls.full,
            thumb_url: item.urls.thumb,
            photo_width: item.width,
            photo_height: item.height,
          })
        })
      }
    })
    .then(() => bot.answerInlineQuery(query.id, result, { cache_time: 0 }))
})




