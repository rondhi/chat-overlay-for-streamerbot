

/**
 * @param {string} p The search parameter name
 * @param {boolean} d The default value
 * @returns {boolean} The value of the search parameter, or the default value if the parameter is not set.
 */
function searchParamIsTrue(p, d = false) {
  let v = new URLSearchParams(window.location.search).get(p);
  if (v === undefined || v === null) {
    return d;
  }

  return String(v).toLowerCase() === 'true' || String(v) === '1';
}

function searchParamOrDefault(p, d = null) {
  let v = new URLSearchParams(window.location.search).get(p);
  if (v === null) {
    return d;
  }
  return v;
}

function htmlentities(str) {
  return str.replace(/[\u00A0-\u9999<>&]/gim, (i) => {
    return '&#' + i.charCodeAt(0) + ';';
  });
}

const host = searchParamOrDefault('host', '127.0.0.1');
const port = searchParamOrDefault('port', 8080);
const client = new StreamerbotClient({
  scheme: 'ws',
  host: host,
  port: port,
  onConnect: (sbInfo) => {
    const sbName = sbInfo.name;
    console.log(`Connected to Streamer.bot '${sbName}' on ${host}:${port}`);
  },
  onDisconnect: () => {
    console.warn('Disconnected from Streamer.Bot socket.');
  },
});

const STREAMCHAT_VERSION = '0.3.3';
const STREAMCHAT_GH_USER = 'rondhi';
const STREAMCHAT_GH_REPO = 'chat-overlay-for-streamerbot';

class ConnectionStatus {
  /**
   * @type {number}
   * @value 0
   */
  static DISCONNECTED = 0;

  /**
   * @type {number}
   * @value 1
   */
  static CONNECTING = 1;

  /**
   * @type {number}
   * @value 2
   */
  static CONNECTED = 2;

  /**
   * @type {number}
   * @value 3
   */
  static ERROR = 3;

  /**
   * @type {Object.<string, number>}
   */
  status = {
    StreamerBot: ConnectionStatus.DISCONNECTED,
    BeanBot: ConnectionStatus.DISCONNECTED,
  };

  update() {
    let status = ConnectionStatus.CONNECTED;
    for (let key in this.status) {
      if (
        !Object.prototype.hasOwnProperty.call(
          config['plugins'],
          key.toLowerCase()
        ) ||
        config['plugins'][key.toLowerCase()]['enabled'] == false
      ) {
        continue;
      }

      if (this.status[key] == ConnectionStatus.DISCONNECTED) {
        status = ConnectionStatus.DISCONNECTED;
        break;
      } else if (this.status[key] == ConnectionStatus.CONNECTING) {
        status = ConnectionStatus.CONNECTING;
      }
    }

    let status_text = '',
      status_div = document.getElementById('connection-status');

    switch (status) {
      case ConnectionStatus.DISCONNECTED:
        status_text = 'disconnected. Is your bot running?';
        status_div.style.display = 'block';
        break;
      case ConnectionStatus.CONNECTING:
        status_text = 'connecting';
        status_div.style.display = 'block';
        break;
      case ConnectionStatus.CONNECTED:
        status_div.style.display = 'none';
        break;
      case ConnectionStatus.ERROR:
        status_text = 'experiencing an error';
        status_div.style.display = 'block';
        break;
    }

    status_div.innerText = 'You are currently ' + status_text;
  }
}

const PLUGIN_LIST = Object.keys(new ConnectionStatus().status);
window.CONNECTION_STATUS = new Proxy(new ConnectionStatus(), {
  get(target, name, receiver) {
    if (PLUGIN_LIST.includes(name)) {
      return Reflect.get(target['status'], name, receiver);
    } else {
      return Reflect.get(target, name, receiver);
    }
  },

  set(target, name, value, receiver) {
    if (PLUGIN_LIST.includes(name)) {
      target['status'][name] = value;
      target.update();
    } else {
      return Reflect.set(target, name, value, receiver);
    }
  },
});

/**
 * Checks the current version of streamchat against the latest release on GitHub.
 * @returns {string} A message indicating whether the current version is up to date or not.
 */
async function version_check() {
  const res = await fetch(
    `https://api.github.com/repos/${STREAMCHAT_GH_USER}/${STREAMCHAT_GH_REPO}/releases/latest`
  )
    .then((response) => response.json())
    .then((data) => {
      const version = data.tag_name.replace(/^v/i, '');
      const version_parts = version.split('.');
      const current_version_parts = STREAMCHAT_VERSION.split('.');
      let upToDate = true;

      if (version_parts[0] > current_version_parts[0]) {
        console.debug(
          `${STREAMCHAT_GH_REPO} version ${STREAMCHAT_VERSION} is outdated. There is a major update to version ${data.tag_name} available.`
        );
        upToDate = false;
      } else if (
        (version_parts[0] === current_version_parts[0] &&
          version_parts[1] > current_version_parts[1]) ||
        (version_parts[0] === current_version_parts[0] &&
          version_parts[1] === current_version_parts[1] &&
          version_parts[2] > current_version_parts[2])
      ) {
        console.debug(
          `${STREAMCHAT_GH_REPO} version ${STREAMCHAT_VERSION} is outdated. Please update to version ${data.tag_name}`
        );
        upToDate = false;
      } else {
        console.debug(
          `${STREAMCHAT_GH_REPO} version ${STREAMCHAT_VERSION} is up to date or newer than the latest release ${data.tag_name}`
        );
      }

      return { version: version, upToDate: upToDate, error: null };
    })
    .catch((error) => {
      console.error(error);
      return { version: 'unknown', upToDate: true, error: error };
    });
  return res;
}

function getRnd(max, min = 0) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

/**
 * @param {string} tag The HTML tag name
 * @param {object} attributes Attributes for the HTML tag
 * @param {string} text The innerText of the HTML tag
 * @returns {string}
 */
function createElement(tag, attributes, text = false) {
  let element = document.createElement(tag);

  if (attributes !== undefined) {
    for (let key in attributes) {
      element.setAttribute(key, attributes[key]);
    }
  }

  if (text !== undefined && text !== false) {
    element.innerText = text;
  }

  return element;
}

function parseURL() {
  let url = new URL(document.URL);

  let direction = 'vertical';
  if (url.searchParams.get('direction') !== null) {
    direction =
      url.searchParams.get('direction').toLowerCase() === 'horizontal'
        ? 'horizontal'
        : 'vertical';
  }

  const get_color = (p, d = null) => {
    let u = url.searchParams.get(p);
    if (u === null) {
      return d;
    }
    let c = {
      r: u.slice(0, 2),
      g: u.slice(2, 4),
      b: u.slice(4, 6),
    };
    return c;
  };
  let colors = {
    page_background: get_color('background'),
    text_background: get_color('bubble_color'),
    text: get_color('text_color'),
    message: get_color('msg_color'),
    announcement: {
      text: get_color('announcement_color'),
      background: get_color('announcement_bg_color'),
    },
    highlight: {
      text: get_color('highlight_color'),
      background: get_color('highlight_bg_color'),
    },
    default: get_color('default_color', {
      r: 'ff',
      g: 'e0',
      b: 'f0',
    }),
    pastel: searchParamIsTrue('pastel'),
    bubble_border: get_color('bubble_border_color'),
  };

  let cmdprefix = null;
  if (url.searchParams.get('cmdprefix') !== null) {
    cmdprefix = url.searchParams.get('cmdprefix');
  }

  let bot_list = [];
  if (url.searchParams.get('bots') !== null) {
    bot_list = url.searchParams.get('bots').toLowerCase().split(',');
  }

  // TODO: Implement different timestamp formats
  let timestamp = false;
  let timestamp_locale = 'en-US';
  let timestamp_options = {
    hour: '2-digit',
    minute: '2-digit',
  };

  if (url.searchParams.get('timestamp') !== null) {
    timestamp = searchParamIsTrue('timestamp');
  }

  if (url.searchParams.get('timestamp_locale') !== null) {
    timestamp_locale = url.searchParams.get('timestamp_locale');
  }

  // Streamer.Bot specific configuration
  let streamerbotEnabled = true;
  let streamerbotConfig = {
    enabled: false,
    twitch: false,
    youtube: false,
    trovo: false,
    websocket: '',
  };
  if (streamerbotEnabled === searchParamIsTrue('sb_enabled', true)) {
    let sb_ws_uri = 'ws://127.0.0.1:8080/';
    if (url.searchParams.get('sb_ws_uri') !== null) {
      sb_ws_uri = decodeURI(url.searchParams.get('sb_ws_uri'));
    }

    streamerbotConfig = {
      enabled: streamerbotEnabled,
      twitch: searchParamIsTrue('sb_twitch', true),
      youtube: searchParamIsTrue('sb_youtube', true),
      trovo: searchParamIsTrue('sb_trovo', true),
      websocket: sb_ws_uri,
    };
  }

  // Bean.Bot specific configuration
  /* let beanbotEnabled = true;
    let beanbotConfig = {
        'enabled': false,
        'twitch': false,
        'websocket': 'ws://localhost:6969/',
    }; */
  return {
    plugins: {
      streamerbot: streamerbotConfig,
      beanbot: {
        enabled: searchParamIsTrue('bb_enabled'),
      },
    },
    ui: {
      direction: direction,
      bubbles: {
        enabled: searchParamIsTrue('bubbles'),
        border: {
          radius: searchParamOrDefault('bubble_border_radius', null),
          size: searchParamOrDefault('bubble_border_size', null),
        },
      },
      colors: colors,
      timestamp: {
        enabled: timestamp,
        locale: timestamp_locale,
        options: timestamp_options,
      },
      fade_duration: searchParamOrDefault('fade_duration', false),
      max_messages: searchParamOrDefault('max_messages', false),
      pronouns: searchParamIsTrue('pronouns', true),
      platforms: searchParamIsTrue('platforms', true),
      highlights: searchParamIsTrue('highlights', true),
      announcements: searchParamIsTrue('announcements', true),
      badges: {
        enabled: searchParamIsTrue('badges', true),
        left: searchParamIsTrue('badges_left'),
      },
      emote_size: searchParamOrDefault('emote_size', '1.4rem'),
      font: {
        family: searchParamOrDefault('fontfamily', 'Open Sans'),
        size: searchParamOrDefault('fontsize', 'large'),
      },
    },
    exclusion: {
      cmdprefix: cmdprefix,
      bots: bot_list,
    },
    debug: searchParamIsTrue('debug'),
    version: {
      current: STREAMCHAT_VERSION,
      check: searchParamIsTrue('version_check', false),
      alert: searchParamIsTrue('version_alert', false),
    },
  };
}

const config = parseURL();

console.debug(`Starting stream chat version ${STREAMCHAT_VERSION}`);
console.debug(['Loaded config', config]);

let pronouns_users = {},
  pronouns;
let pronounStr = '';
let usePronouns = config.ui.pronouns;

// Fill the pronoun cache
try {
  fetch('https://api.pronouns.alejo.io/v1/pronouns')
    .then((response) => response.json())
    .then((data) => {
      pronouns = data;
      // console.table(pronouns);
    })
    .catch((error) => {
      console.error(`Failed to fetch pronouns: ${error}`);
    });
} catch (error) {
  console.error(`Failed fetching pronouns: ${error}`);
}

/**
 * Get the pronoun for a user and cache it for future use
 *
 * @param {string} user The user to get the pronoun for
 * @returns {object} The pronoun for the user
 */
async function fetch_pronoun(user) {
  user = user.toLowerCase();

  if (user in pronouns_users) {
    return pronouns_users[user];
  } else {
    const response = await fetch(
      `https://api.pronouns.alejo.io/v1/users/${user}`
    );
    const data = await response.json();

    // Store the fetched data in the pronoun_users object
    pronouns_users[user] = data.pronoun_id;
    // console.log(`pronounId for '${user}': '${data.pronoun_id}'`);
  }
}

/**
 * Get the pronoun for a user.
 * This is a wrapper for fetch_pronoun() that returns either the pronoun or false when pronouns are disabled,
 * when pronouns for the user aren't set or the API is unavailable.
 *
 * @param {string} user The user to get the pronoun for
 * @returns {string} The pronoun for the user
 */
function get_pronoun(user) {
  user = user.toLowerCase();

  if (
    config['ui']['pronouns'] === true &&
    user in pronouns_users &&
    pronouns_users[user] !== undefined
  ) {
    const pronounId = pronouns_users[user];
    if (pronounId === 'any') {
      return 'Any';
    } else if (pronouns[pronounId]) {
      return `(${pronouns[pronounId].subject}/${pronouns[pronounId].object})`; // Adjust based on how you want to display the pronoun
    } else {
      return '';
    }
  } else {
    return false;
  }
}

/**
 * Get the text colour for a user.
 * TODO: change color to RGB object
 *
 * @param {Color} color The user's text color
 * @returns {string} The calculated color according to settings
 */
function get_text_color(color, noDefault = false) {
  // TODO pastel mode for text color
  if (config['ui']['colors']['text'] && noDefault === false) {
    return config['ui']['colors']['text'];
  }

  let color_r = parseInt(color.r, 16);
  let color_g = parseInt(color.g, 16);
  let color_b = parseInt(color.b, 16);

  let brightness = Math.round(
    (parseInt(color_r) * 299 +
      parseInt(color_g) * 587 +
      parseInt(color_b) * 114) /
      1000
  );

  if (brightness < 125) {
    return {
      r: 'FF',
      g: 'FF',
      b: 'FF',
    };
  } else {
    return {
      r: '00',
      g: '00',
      b: '00',
    };
  }
}

/**
 * Get the background color for a user.
 * @param {Color} color An RGB tuple of the user's text color
 * @param {string} override_source Config attribute to take for overrides
 * @returns {Color} The background color for the user
 */
function get_user_color(color, override_source = 'text_background') {
  // TODO pastel mode for background color
  if (config['ui']['colors'][override_source]) {
    return config['ui']['colors'][override_source];
  }

  if (color === null || color === undefined) {
    return config['ui']['colors']['default'];
  } else {
    return color;
  }
}

/**
 * Returns a normalized version of the given color as RGB struct.
 * @param {string} color A string containing a color in hexadecimal RGB notation
 * @returns {Color} The normalized color tuple
 */
function get_color(color) {
  if (color === null || color === undefined) {
    return config['ui']['colors']['default'];
  } else {
    color = color.replace('#', '');
    return {
      r: color.slice(0, 2),
      g: color.slice(2, 4),
      b: color.slice(4, 6),
    };
  }
}

/**
 * Returns a hex code from an RGB color struct.
 * @param {Color} color An RGB color struct
 * @returns {string} A hex color code
 */
function get_color_hex(color) {
  if (color === 'transparent') {
    return 'transparent';
  } else if (color === null || color === undefined) {
    return get_color_hex(config['ui']['colors']['default']);
  } else {
    return `#${color.r}${color.g}${color.b}`;
  }
}

/**
 * Enum to differenciate between different highlight styles
 * Currently only used for Twitch messages
 */
const Highlights = {
  None: Symbol('None'),
  Highlight: Symbol('Highlight'),
  //Mention: Symbol('Mention'), // TODO: Might be worth implementing this?
  Announcement: Symbol('Announcement'),
};

let add_message = (
  id,
  message,
  author,
  color,
  timestamp,
  badges = [],
  highlight = Highlights.None
) => {
  let background_color = get_user_color(color);
  let text_color = get_text_color(background_color);

  let el_badges = createElement('span', { class: 'msg-badges' });
  let el_pronoun = createElement(
    'span',
    { class: 'msg-pronoun' },
    author['pronoun']
  );
  let el_message = createElement('span', { class: 'msg-text' });
  let el_user = createElement('span', { class: 'msg-user' }, author.name);

  let div_message = createElement('div', {
    id: id,
    'data-user-id': author['id'],
    class: 'chat-message',
  });

  // let message_class = [];
  if (highlight !== Highlights.None) {
    if (
      highlight === Highlights.Highlight &&
      config['ui']['highlights'] === true
    ) {
      div_message.classList.add('highlight');
    } else if (highlight === Highlights.Announcement) {
      div_message.classList.add('announcement');
    }
  }

  // TODO: omg this code is a mess and needs to get some a e s t h e t i c s
  // For one, if we have user configs for some colours, we don't need to overwrite them
  // Also, we should probably use CSS variables for some things
  // Alternatively maybe just a data attribute with the user's color like
  // data-user-color='#123456' and then use that in the CSS with color: attr(data-user-color)
  // which would be a lot cleaner and would get the style issues out of the JS code
  if (config['ui']['bubbles']['enabled'] === true) {
    div_message.classList.add('bubble');
  }

  // For announcements we want the background to be filled
  if (
    config['ui']['announcements'] === true &&
    (highlight === Highlights.Announcement ||
      highlight === Highlights.Highlight)
  ) {
    let config_key =
      highlight === Highlights.Announcement ? 'announcement' : 'highlight';

    if (config['ui']['colors'][config_key]['background']) {
      background_color = config['ui']['colors'][config_key]['background'];
    } else {
      background_color = get_user_color(color);
    }

    if (config['ui']['colors'][config_key]['text']) {
      text_color = config['ui']['colors'][config_key]['text'];
    } else {
      // We calculate the text color based on the new background color
      // If we don't do this, the text might be completely unreadable
      // Second parameter is noDefault to prevent getting the default
      // text color which might or might not work with the new background
      text_color = get_text_color(background_color, true);
    }

    if (config['ui']['bubbles']['enabled'] === true) {
      // Announcement/Highlight styling for message bubbles
      div_message.style.color = get_color_hex(text_color);

      if (config['ui']['colors']['bubble_border']) {
        div_message.style.borderColor = get_color_hex(
          config['ui']['colors']['bubble_border']
        );
      } else {
        div_message.style.borderColor = get_color_hex(background_color);
      }

      el_user.style.color = get_color_hex(text_color);
      el_user.style.backgroundColor = get_color_hex(background_color);
    } else {
      // Announcement/Highlight styling for regular text messages
      div_message.style.color = get_color_hex(text_color);
      el_message.style.color = get_color_hex(text_color);
    }

    div_message.style.backgroundColor = get_color_hex(background_color);

    // TODO: For announcement, get an enum for the colour of the announcement
    //       and add a CSS class with nice colours and gradients
  } else {
    // Everything specific for anything that's not announcement or highlight
    if (config['ui']['bubbles']['enabled'] === true) {
      if (!config['ui']['colors']['bubble_border']) {
        div_message.style.borderColor = get_color_hex(background_color);
      }

      el_user.style.backgroundColor = get_color_hex(background_color);
    } else {
      // If we don't use bubbles, we don't use the user colour as background
      if (!config['ui']['colors']['text_color']) {
        text_color = get_user_color(color, 'text_color');
      }
    }

    el_user.style.color = get_color_hex(text_color);
  }

  if (config['ui']['badges']['enabled'] === true && badges.length > 0) {
    for (let badge of badges) {
      let el_badge = createElement('img', {
        src: badge['url'],
      });
      el_badges.appendChild(el_badge);
    }

    // Add badges to the user line
    if (config['ui']['badges']['left'] === false) {
      el_user.appendChild(el_badges);
    } else {
      el_user.prepend(el_badges);
    }
  }

  el_message.innerHTML = message;

  // Add the timestamp
  if (config['ui']['timestamp']['enabled'] === true) {
    let el_timestamp = createElement(
      'span',
      { class: 'msg-timestamp' },
      new Date().toLocaleTimeString(
        config['ui']['timestamp']['locale'],
        config['ui']['timestamp']['options']
      )
    );
    if (config['ui']['bubbles']['enabled'] === false) {
      div_message.appendChild(el_timestamp);
    } else {
      el_user.prepend(el_timestamp);
    }
  }

  // Add the pronoun to the user line
  if (author['pronoun']) {
    el_user.appendChild(el_pronoun);
  }

  // Adds the user line and message to the message div
  div_message.appendChild(el_user);
  div_message.appendChild(el_message);

  document.getElementById('chat').appendChild(div_message);

  const element = document.getElementById('chat');
  element.scrollTop = element.scrollHeight;
};

let StreamerBot = {
  message: {
    twitch: async (
      msg_id,
      user_id,
      author,
      author_color,
      message,
      emotes = [],
      // role = 0,
      badges = [],
      highlight = Highlights.None,
      pronoun = false
    ) => {
      // TODO handle cheermotes

      if (skip_message(message, author)) {
        return;
      }

      if (usePronouns && pronoun === false) {
        await fetch_pronoun(author);
        pronounStr = get_pronoun(author);
        pronoun = true;
      } else if (pronoun != false) {
        pronounStr = pronoun;
      }
      
      if (config['ui']['pronouns'] && config['ui']['platforms']) {
        pronounStr = `${pronounStr} (Twitch)`;
      }

      // console.log(`pronounStr: '${pronounStr}'`);
      author = {
        name: author,
        id: user_id,
        pronoun: pronounStr,
      };
      // console.log(`author['pronoun']: '${author['pronoun']}'`);

      if (emotes.length === 0) {
        // XSS protection for the message
        message = htmlentities(message);
      } else {
        let message_index = 0;
        let message_new = '';

        for (const emote in emotes.sort((a, b) => {
          if (a.startIndex > b.startIndex) {
            return 1;
          } else {
            return -1;
          }
        })) {
          const el_emote = document.createElement('img');
          // The replace call is a workaround for FFZ emotes, see #35
          // https://github.com/izzy/stream-chat/issues/35#issuecomment-1484156496
          el_emote.src = emotes[emote].imageUrl.replace('https:https', 'https');
          if (parseInt(config['ui']['emote_size']) > 0) {
            el_emote.style.height = `${config['ui']['emote_size']}`;
            el_emote.style.width = 'auto';
          }

          // Add the text before the emote to the message, html escaped
          // then add the emote as img element
          message_new +=
            htmlentities(
              message.substring(message_index, emotes[emote].startIndex)
            ) + el_emote.outerHTML;

          // This is the index of the next character after the emote
          // so we can continue the loop from there
          message_index = emotes[emote].endIndex + 1;
        }
        message_new += htmlentities(message.substring(message_index));
        message = message_new;
      }

      if (badges.length > 0) {
        badges = badges.map((badge) => {
          return {
            url: badge['imageUrl'],
          };
        });
      }

      if (Highlights.Announcement === highlight) {
        message =
          '<span class="announcement">📢 Announcement: </span>' + message;
      }

      let color = get_color(author_color);
      add_message(msg_id, message, author, color, 0, badges, highlight);
    },

    youtube: (
      message_id,
      user_id,
      user_name,
      message,
      timestamp
      /* owner, moderator, sponsor,
            verified */
    ) => {
      // TODO: Add message
      // TODO: Add youtube logo as badge
      // TODO: Add badges for owner, moderator, sponsor, verified

      let platformStr = '';
      if (config['ui']['pronouns'] && config['ui']['platforms']) {
        platformStr = `(YouTube)`;
      }

      let author = {
        name: user_name,
        id: user_id,
        pronoun: platformStr,
      };

      let color = get_user_color({
        r: 'FF',
        g: '00',
        b: '00',
      });
      let badges = [
        {
          url: 'https://yt3.ggpht.com/m6yqTzfmHlsoKKEZRSZCkqf6cGSeHtStY4rIeeXLAk4N9GY_yw3dizdZoxTrjLhlY4r_rkz3GA=w24-h24-c-k-nd',
        },
      ];
      message = htmlentities(message);

      let yt_emote_width = '28';
      let yt_emote_height = '28';

      if (parseInt(config['ui']['emote_size']) > 0) {
        yt_emote_width = config['ui']['emote_size'];
        yt_emote_height = config['ui']['emote_size'];
      }

      const yt_emotes = {
        ':yt:': `https://yt3.ggpht.com/m6yqTzfmHlsoKKEZRSZCkqf6cGSeHtStY4rIeeXLAk4N9GY_yw3dizdZoxTrjLhlY4r_rkz3GA=w${yt_emote_width}-h${yt_emote_height}-c-k-nd`,
        ':oops:': `https://yt3.ggpht.com/qByNS7xmuQXsb_5hxW2ggxwQZRN8-biWVnnKuL5FK1zudxIeim48zRVPk6DRq_HgaeKltHhm=w${yt_emote_width}-h${yt_emote_height}-c-k-nd`,
        ':buffering:': `https://yt3.ggpht.com/foWgzjN0ggMAA0CzDPfPZGyuGwv_7D7Nf6FGLAiomW5RRXj0Fs2lDqs2U6L52Z4J2Zb-D5tCUAA=w${yt_emote_width}-h${yt_emote_height}-c-k-nd`,
        ':stayhome:': `https://yt3.ggpht.com/u3QDxda8o4jrk_b01YtJYKb57l8Zw8ks8mCwGkiZ5hC5cQP_iszbsggxIWquZhuLRBzl5IEM2w=w${yt_emote_width}-h${yt_emote_height}-c-k-nd`,
        ':dothefive:': `https://yt3.ggpht.com/ktU04FFgK_a6yaXCS1US-ReFkLjD22XllcIMOyBRHuYKLsrxpVxsauV1gSC2RPraMJWXpWcY=w${yt_emote_width}-h${yt_emote_height}-c-k-nd`,
        ':elbowbump:': `https://yt3.ggpht.com/gt39CIfizoIAce9a8IzjfrADV5CjTbSyFKUlLMXzYILxJRjwAgYQQJ9PXXxnRvrnTec7ZpfHN4k=w${yt_emote_width}-h${yt_emote_height}-c-k-nd`,
        ':goodvibes:': `https://yt3.ggpht.com/6LPOiCw9bYr3ZXe8AhUoIMpDe_0BglC4mBmi-uC4kLDqDIuPu4J3ErgV0lEhgzXiBluq-I8j=w${yt_emote_width}-h${yt_emote_height}-c-k-nd`,
        ':thanksdoc:': `https://yt3.ggpht.com/Av7Vf8FxIp0_dQg4cJrPcGmmL7v9RXraOXMp0ZBDN693ewoMTHbbS7D7V3GXpbtZPSNcRLHTQw=w${yt_emote_width}-h${yt_emote_height}-c-k-nd`,
        ':videocall:': `https://yt3.ggpht.com/bP-4yir3xZBWh-NKO4eGJJglr8m4dRnHrAKAXikaOJ0E5YFNkJ6IyAz3YhHMyukQ1kJNgQAo=w${yt_emote_width}-h${yt_emote_height}-c-k-nd`,
        ':virtualhug:': `https://yt3.ggpht.com/-o0Di2mE5oaqf_lb_RI3igd0fptmldMWF9kyQpqKWkdAd7M4cT5ZKzDwlmSSXdcBp3zVLJ41yg=w${yt_emote_width}-h${yt_emote_height}-c-k-nd`,
        ':yougotthis:': `https://yt3.ggpht.com/WxLUGtJzyLd4dcGaWnmcQnw9lTu9BW3_pEuCp6kcM2pxF5p5J28PvcYIXWh6uCm78LxGJVGn9g=w${yt_emote_width}-h${yt_emote_height}-c-k-nd`,
        ':sanitizer:': `https://yt3.ggpht.com/4PaPj_5jR1lkidYakZ4EkxVqNr0Eqp4g0xvlYt_gZqjTtVeyHBszqf57nB9s6uLh7d2QtEhEWEc=w${yt_emote_width}-h${yt_emote_height}-c-k-nd`,
        ':takeout:': `https://yt3.ggpht.com/ehUiXdRyvel0hba-BopQoDWTvM9ogZcMPaaAeR6IA9wkocdG21aFVN_IylxRGHtl2mE6L9jg1Do=w${yt_emote_width}-h${yt_emote_height}-c-k-nd`,
        ':hydrate:': `https://yt3.ggpht.com/Plqt3RM7NBy-R_eA90cIjzMEzo8guwE0KqJ9QBeCkPEWO7FvUqKU_Vq03Lmv9XxMrG6A3Ouwpg=w${yt_emote_width}-h${yt_emote_height}-c-k-nd`,
        ':chillwcat:': `https://yt3.ggpht.com/ZN5h05TnuFQmbzgGvIfk3bgrV-_Wp8bAbecOqw92s2isI6GLHbYjTyZjcqf0rKQ5t4jBtlumzw=w${yt_emote_width}-h${yt_emote_height}-c-k-nd`,
        ':chillwdog:': `https://yt3.ggpht.com/jiaOCnfLX0rqed1sISxULaO7T-ktq2GEPizX9snaxvMLxQOMmWXMmAVGyIbYeFS2IvrMpxvFcQ=w${yt_emote_width}-h${yt_emote_height}-c-k-nd`,
        ':elbowcough:': `https://yt3.ggpht.com/kWObU3wBMdHS43q6-ib2KJ-iC5tWqe7QcEITaNApbXEZfrik9E57_ve_BEPHO86z4Xrv8ikMdW0=w${yt_emote_width}-h${yt_emote_height}-c-k-nd`,
        ':learning:': `https://yt3.ggpht.com/LiS1vw8KUXmczimKGfA-toRYXOcV1o-9aGSNRF0dGLk15Da2KTAsU-DXkIao-S7-kCkSnJwt=w${yt_emote_width}-h${yt_emote_height}-c-k-nd`,
        ':washhands:': `https://yt3.ggpht.com/66Fn-0wiOmLDkoKk4FSa9vD0yymtWEulbbQK2x-kTBswQ2auer_2ftvmrJGyMMoqEGNjJtipBA=w${yt_emote_width}-h${yt_emote_height}-c-k-nd`,
        ':socialdist': `https://yt3.ggpht.com/0WD780vTqUcS0pFq423D8WRuA_T8NKdTbRztChITI9jgOqOxD2r6dthbu86P6fIggDR6omAPfnQ=w${yt_emote_width}-h${yt_emote_height}-c-k-nd`,
        ':shelterin:': `https://yt3.ggpht.com/KgaktgJ3tmEFB-gMtjUcuHd6UKq50b-S3PbHEOSUbJG7UddPoJSmrIzysXA77jJp5oRNLWG84Q=w${yt_emote_width}-h${yt_emote_height}-c-k-nd`,
      };

      for (const e in yt_emotes) {
        let el_emote = document.createElement('img');
        el_emote.src = yt_emotes[e];
        el_emote.style = `height: ${yt_emote_height}px; width: ${yt_emote_width}px;`;

        message = message.replaceAll(e, el_emote.outerHTML);
      }

      add_message(
        message_id,
        message,
        author,
        color,
        timestamp,
        badges,
        Highlights.None
      );
    },

    trovo: (
      message_id,
      content,
      // emotes,
      timestamp,
      userId,
      // login,
      userName
      // profileUrl,
      // medals,
      // roles,
      // streamer,
      // moderator,
      // subscriber,
      // follower,
      // tier,
    ) => {
      let platformStr = '';
      if (config['ui']['pronouns'] && config['ui']['platforms']) {
        platformStr = `(Trovo)`;
      }

      let author = {
        name: userName,
        id: userId,
        pronoun: platformStr,
      };

      // rgb(45, 153, 102)
      let color = get_user_color({
        r: '2D',
        g: '99',
        b: '66',
      });

      add_message(
        message_id,
        content,
        author,
        color,
        timestamp,
        Highlights.None
      );
    },
  },
};

/* let BeanBot = {
    'message': {
        'twitch': (message) => {
            console.log(message);
        }
    }
} */

/**
 * Checks if a message should be skipped.
 * @param {string} message The message to check
 * @param {string} user The user name to check
 * @returns {boolean} True if the message should be skipped, false otherwise
 */
function skip_message(message, user) {
  if (
    (config['exclusion']['cmdprefix'] !== false &&
      message.startsWith(config['exclusion']['cmdprefix'])) ||
    config['exclusion']['bots'].includes(user.toLowerCase())
  ) {
    return true;
  } else {
    return false;
  }
}

function remove_old_messages() {
  let chat = document.getElementById('chat');
  let messages = chat.getElementsByClassName('chat-message');
  let messages_to_remove = [];

  // Remove old messages when there are more than the max_messages setting
  if (config['ui']['max_messages'] !== false) {
    let max_messages = config['ui']['max_messages'];
    if (messages.length > max_messages) {
      for (let i = 0; i < messages.length - max_messages; i++) {
        messages_to_remove.push(messages[i]);
      }
    }
  }

  for (let i = 0; i < messages.length; i++) {
    // Remove messages that are outside the bounding box
    // bottom when vertical scrolling is enabled,
    // right when horizontal scrolling is enabled
    if (
      (config['ui']['direction'] === 'vertical' &&
        messages[i].getBoundingClientRect().bottom < 0) ||
      (config['ui']['direction'] === 'horizontal' &&
        messages[i].getBoundingClientRect().right < 0)
    ) {
      messages_to_remove.push(messages[i]);
    }

    // Remove messages that are older than the max age (fade_duration)
    else if (
      parseInt(config['ui']['fade_duration']) > 0 &&
      window.getComputedStyle(messages[i]).opacity === '0'
    ) {
      messages_to_remove.push(messages[i]);
    }
  }

  for (let message of messages_to_remove) {
    chat.removeChild(message);
  }
}

function remove_messages_by_user_id(user_id) {
  console.debug('Removing messages by user id: ' + user_id);

  let chat = document.getElementById('chat');
  let messages = chat.getElementsByClassName('chat-message');
  let messages_to_remove = [];

  for (let i = 0; i < messages.length; i++) {
    if (parseInt(messages[i].dataset.userId) === user_id) {
      messages_to_remove.push(messages[i]);
    }
  }

  for (let message of messages_to_remove) {
    chat.removeChild(message);
  }
}

function remove_messages_by_message_id(message_id) {
  console.debug('Removing messages by message id: ' + message_id);

  let chat = document.getElementById('chat');
  let messages = chat.getElementsByClassName('chat-message');
  let messages_to_remove = [];

  for (let i = 0; i < messages.length; i++) {
    if (messages[i].id === message_id) {
      messages_to_remove.push(messages[i]);
    }
  }

  for (let message of messages_to_remove) {
    chat.removeChild(message);
  }
}

function initializeTheme() {
  // Set up the UI
  if (config['ui']['bubbles']['enabled'] === true) {
    document.getElementById('enable-bubbles').removeAttribute('type');
  }

  if (config['ui']['direction'] === 'horizontal') {
    document.getElementById('enable-horizontal').removeAttribute('type');
  }

  if (
    config['ui']['bubbles']['enabled'] === true &&
    config['ui']['direction'] === 'horizontal'
  ) {
    document.getElementById('horizontal-bubbles').removeAttribute('type');
  }

  // Create a new CSS style element and add it to the DOM
  const customStyle = document.getElementById('user-styles').sheet;

  // Function to add a new rule to the custom style element if the user
  // configuration has a value for it
  function addCSSRule(config_item, selector, op, important = false) {
    if (config_item != null) {
      // If we deal with a color, convert it to normalized hex value
      if (op.includes('color')) {
        config_item = get_color_hex(config_item);
      }

      // Add !important to the end of the rule if we need to
      // This must happen *after* the color conversion above
      if (important === true) {
        config_item += ' !important';
      }

      // Add the rule to the style element
      customStyle.insertRule(`${selector} { ${op}: ${config_item}; }`);
      console.debug(`Added CSS rule: ${selector} { ${op}: ${config_item}; }`);
    }
  }

  // Add the custom CSS defined by the user configuration to the style element
  // we defined above

  // We define some variables to make the code and reduce mistakes made
  // with class names
  let announce = '.announcement',
    message = '.chat-message',
    username = '.msg-user',
    bubble = '.bubble',
    highlight = '.highlight';

  // Rules for sizes and fonts
  addCSSRule(config['ui']['font']['family'], 'body', 'font-family');
  addCSSRule(config['ui']['font']['size'], 'body', 'font-size');
  addCSSRule(config['ui']['emote_size'], `${message} > img`, 'width');

  // Rules for colors
  //addCSSRule(config['ui']['colors']['default'], `${message}.defaultcolor`, 'color');
  addCSSRule(
    config['ui']['colors']['page_background'],
    'body',
    'background-color'
  );

  // Some colors are applied to different elements depending on the bubble settings
  if (config['ui']['bubbles']['enabled'] === true) {
    addCSSRule(config['ui']['colors']['bubble_border'], bubble, 'border-color');
    addCSSRule(
      config['ui']['bubbles']['border']['radius'],
      bubble,
      'border-radius'
    );
    addCSSRule(
      config['ui']['bubbles']['border']['size'],
      bubble,
      'border-width'
    );

    addCSSRule(
      config['ui']['colors']['text_background'],
      username,
      'background-color'
    );
    addCSSRule(config['ui']['colors']['message'], message, 'color');
    addCSSRule(config['ui']['colors']['text'], username, 'color');
  } else {
    addCSSRule(
      config['ui']['colors']['text'],
      `${message}:not(${highlight}, ${announce}) ${username}`,
      'color',
      true
    );
    addCSSRule(
      config['ui']['colors']['message'],
      `${message}:not(${highlight}, ${announce})`,
      'color',
      true
    );
  }

  // Rules for animations
  addCSSRule(
    config['ui']['fade_duration'],
    message,
    'transition: max-height 0.3s ease-out; animation: chat 1s ease ' +
      config['ui']['fade_duration'] +
      's 1 normal forwards; margin-left: 0.5rem; float: left;'
  );

  // Rules for announcements
  addCSSRule(
    config['ui']['colors']['announcement']['text'],
    announce,
    'color',
    true
  );
  addCSSRule(
    config['ui']['colors']['announcement']['text'],
    `${announce} ${username}`,
    'color',
    true
  );
  addCSSRule(
    config['ui']['colors']['announcement']['background'],
    announce,
    'background-color'
  );

  // Rules for highlights
  addCSSRule(
    config['ui']['colors']['highlight']['text'],
    highlight,
    'color',
    true
  );
  addCSSRule(
    config['ui']['colors']['highlight']['text'],
    `${highlight} ${username}`,
    'color',
    true
  );
  addCSSRule(
    config['ui']['colors']['highlight']['background'],
    highlight,
    'background-color'
  );
}

// Real events
function initializeConnections() {
  let m;
  // Twitch Chat Message
  client.on('Twitch.ChatMessage', (wsdata) => {
    // console.log(wsdata.data.message);
    m = wsdata.data.message;
    StreamerBot['message']['twitch'](
      m.msgId,
      m.userId,
      m.displayName,
      m.color,
      m.message,
      m.emotes,
      // m.role,
      m.badges,
      m.isHighlighted ? Highlights.Highlight : Highlights.None
    );
  });

  // Twitch Announcement
  client.on('Twitch.Announcement', (wsdata) => {
    m = wsdata.data;
    if (config['ui']['announcements'] === false) {
      return;
    }

    let color = '';
    switch (m.announcementColor.toLowerCase()) {
      case 'blue':
        color = '#0099ff';
        break;
      case 'green':
        color = '#00ff00';
        break;
      case 'orange':
        color = '#ff9900';
        break;
      case 'purple':
        color = '#9900ff';
        break;
      default:
        color = m.color;
        break;
    }

    StreamerBot['message']['twitch'](
      m.msgId,
      m.userId,
      m.displayName,
      color,
      m.message,
      m.emotes,
      m.role,
      m.badges,
      Highlights.Announcement
    );
  });

  // Twitch User Timed Out
  client.on('Twitch.UserTimedOut', (wsdata) => {
    remove_messages_by_user_id(wsdata.data.target_user_id);
  });

  // Twitch User Banned
  client.on('Twitch.UserBanned', (wsdata) => {
    remove_messages_by_user_id(wsdata.data.target_user_id);
  });

  // Twitch Chat Message Deleted
  client.on('Twitch.ChatMessageDeleted', (wsdata) => {
    remove_messages_by_message_id(wsdata.data.targetMessageId);
  });

  // YouTube Message
  client.on('YouTube.Message', (wsdata) => {
    let m = wsdata.data;

    if (skip_message(m.message, m.user['name'])) {
      return;
    }

    StreamerBot['message']['youtube'](
      m.eventId,
      m.user.id,
      m.user.name,
      m.message,
      m.user.isOwner,
      m.user.isModerator,
      m.user.isSponsor,
      m.user.isVerified
    );
  });

  client.on('YouTube.MessageDeleted', (wsdata) => {
    console.debug(['Message deleted', wsdata]);
    remove_messages_by_message_id(wsdata.data.eventId);
  });

  client.on('YouTube.UserBanned', (wsdata) => {
    console.debug(['User banned', wsdata]);
    remove_messages_by_user_id(wsdata.data.user.id);
  });

  client.on('Trovo.ChatMessage', (wsdata) => {
    let m = wsdata.data;
    StreamerBot['message']['trovo'](
      m.message_id,
      m.content,
      // m.emotes,
      m.timestamp,
      m.user.userId,
      // m.user.login,
      m.user.userName
      // m.user.profileUrl,
      // m.medals,
      // m.roles,
      // m.streamer,
      // m.moderator,
      // m.subscriber,
      // m.follower,
      // m.tier,
    );
  });

  // The browser is creating elements faster than it can count them
  // If we don't wait a bit, the message count will be wrong and
  // some messages won't be removed according to the user's settings
  setTimeout(remove_old_messages, 400);
}

initializeTheme();
if (config['debug'] === true) {
  // Debugging is used in the Overlay generator live preview
  const messages = ['Are you a robot?', 'How are you?', 'Happy birthday!'];

  const badges = [
    [
      {
        name: 'vip',
        version: '1',
        imageUrl:
          'https://static-cdn.jtvnw.net/badges/v1/b817aba4-fad8-49e2-b88a-7cc744dfa6ec/3',
      },
      {
        name: 'subscriber',
        version: '0',
        imageUrl:
          'https://static-cdn.jtvnw.net/badges/v1/5d9f2208-5dd8-11e7-8513-2ff4adfae661/3',
      },
    ],
    [
      {
        name: 'premium',
        version: '1',
        imageUrl:
          'https://static-cdn.jtvnw.net/badges/v1/bbbe0db0-a598-423e-86d0-f9fb98ca1933/3',
      },
    ],
    [
      {
        name: 'broadcaster',
        version: '1',
        imageUrl:
          'https://static-cdn.jtvnw.net/badges/v1/5527c58c-fb7d-422d-b71b-f309dcb85cc1/3',
      },
      {
        name: 'subscriber',
        version: '0',
        imageUrl:
          'https://static-cdn.jtvnw.net/badges/v1/5d9f2208-5dd8-11e7-8513-2ff4adfae661/3',
      },
      {
        name: 'glhf-pledge',
        version: '1',
        imageUrl:
          'https://static-cdn.jtvnw.net/badges/v1/3158e758-3cb4-43c5-94b3-7639810451c5/3',
      },
    ],
  ];

  const emotes = [
    {
      id: '555555597',
      type: 'Twitch',
      name: ';p',
      startIndex: 3,
      endIndex: 4,
      imageUrl:
        'https://static-cdn.jtvnw.net/emoticons/v2/555555597/default/dark/2.0',
    },
    {
      id: '555555593',
      type: 'Twitch',
      name: ':p',
      startIndex: 6,
      endIndex: 7,
      imageUrl:
        'https://static-cdn.jtvnw.net/emoticons/v2/555555593/default/dark/2.0',
    },
    {
      id: '555555562',
      type: 'Twitch',
      name: '>(',
      startIndex: 12,
      endIndex: 13,
      imageUrl:
        'https://static-cdn.jtvnw.net/emoticons/v2/555555562/default/dark/2.0',
    },
    {
      id: '555555563',
      type: 'Twitch',
      name: ':|',
      startIndex: 15,
      endIndex: 16,
      imageUrl:
        'https://static-cdn.jtvnw.net/emoticons/v2/555555563/default/dark/2.0',
    },
    {
      id: '6',
      type: 'Twitch',
      name: 'O_o',
      startIndex: 18,
      endIndex: 20,
      imageUrl: 'https://static-cdn.jtvnw.net/emoticons/v2/6/default/dark/2.0',
    },
    {
      id: '555555557',
      type: 'Twitch',
      name: ':-)',
      startIndex: 33,
      endIndex: 35,
      imageUrl:
        'https://static-cdn.jtvnw.net/emoticons/v2/555555557/default/dark/2.0',
    },
    {
      id: '555555599',
      type: 'Twitch',
      name: 'R)',
      startIndex: 0,
      endIndex: 1,
      imageUrl:
        'https://static-cdn.jtvnw.net/emoticons/v2/555555599/default/dark/2.0',
    },
    {
      id: '555555589',
      type: 'Twitch',
      name: ';)',
      startIndex: 9,
      endIndex: 10,
      imageUrl:
        'https://static-cdn.jtvnw.net/emoticons/v2/555555589/default/dark/2.0',
    },
    {
      id: '555555578',
      type: 'Twitch',
      name: 'B-)',
      startIndex: 22,
      endIndex: 24,
      imageUrl:
        'https://static-cdn.jtvnw.net/emoticons/v2/555555578/default/dark/2.0',
    },
    {
      id: '555555580',
      type: 'Twitch',
      name: ':O',
      startIndex: 26,
      endIndex: 27,
      imageUrl:
        'https://static-cdn.jtvnw.net/emoticons/v2/555555580/default/dark/2.0',
    },
    {
      id: '555555559',
      type: 'Twitch',
      name: ':-(',
      startIndex: 29,
      endIndex: 31,
      imageUrl:
        'https://static-cdn.jtvnw.net/emoticons/v2/555555559/default/dark/2.0',
    },
  ];

  const names = [
    'Taylor Garcia',
    'Ellen Schwartz',
    'Rebecca Mcintosh',
    'Journey Robles',
    'Rhett Acosta',
    'Logan Burnett',
    'Rigoberto Robertson',
    'Keshawn Miles',
    'Cyrus Ball',
    'Janet Braun',
    'Hadassah Bennett',
    'Joanna Cole',
  ];

  const colors = [
    {
      r: 'B0',
      g: 'BF',
      b: '1A',
    },
    {
      r: '00',
      g: '48',
      b: 'BA',
    },
    {
      r: '7C',
      g: 'B9',
      b: 'E8',
    },
    {
      r: 'C0',
      g: 'E8',
      b: 'D5',
    },
    {
      r: 'B2',
      g: '84',
      b: 'BE',
    },
    {
      r: '72',
      g: 'A0',
      b: 'C1',
    },
    {
      r: 'DB',
      g: '2D',
      b: '43',
    },
    {
      r: 'ED',
      g: 'EA',
      b: 'E0',
    },
    {
      r: 'C4',
      g: '62',
      b: '10',
    },
    {
      r: 'F0',
      g: 'F8',
      b: 'FF',
    },
    {
      r: 'EF',
      g: 'DE',
      b: 'CD',
    },
    {
      r: '9F',
      g: '2B',
      b: '68',
    },
    {
      r: 'E5',
      g: '2B',
      b: '50',
    },
    {
      r: 'AB',
      g: '27',
      b: '4F',
    },
    {
      r: 'F1',
      g: '9C',
      b: 'BB',
    },
    {
      r: '3B',
      g: '7A',
      b: '57',
    },
    {
      r: 'D3',
      g: '21',
      b: '2D',
    },
    null,
  ];

  setInterval(() => {
    let pronounDebug = '';
    if (usePronouns) {
      const rnd = getRnd(Object.keys(pronouns).length - 1);
      const pronounKey = Object.keys(pronouns)[rnd];
      pronounDebug = `${pronouns[pronounKey].subject}/${pronouns[pronounKey].object}`;
    }
    let messagesEmote;
    let username = names[getRnd(names.length - 1)];
    const message = (() => {
      let message = messages[getRnd(messages.length - 1)];
      if (!getRnd(1)) {
        messagesEmote = Array(getRnd(10))
          .fill(undefined)
          .map(() => {
            return emotes[getRnd(emotes.length - 1)];
          });
        messagesEmote.forEach(({ name }) => {
          message = `${message} ${name}`;
        });
      }
      return message;
    })();

    if (skip_message(message, username) === true) {
      return;
    }

    let random = Math.random();
    if (
      random <= 0.33 &&
      config['plugins']['streamerbot']['enabled'] === true &&
      config['plugins']['streamerbot']['twitch'] === true
    ) {
      let highlightkeys = Object.keys(Highlights);
      StreamerBot['message']['twitch'](
        String(Math.random()), // msg_id
        Math.floor(Math.random() * 10000000), // user_id
        username, // author
        get_color_hex(colors[getRnd(colors.length - 1)]), // author_color
        message, // message
        messagesEmote, // emotes
        // getRnd(4, 0),  // role
        badges[getRnd(badges.length - 1)], // badges
        Highlights[highlightkeys[(highlightkeys.length * Math.random()) << 0]], // highlight
        pronounDebug // random pronoun
      );
    } else if (
      random > 0.33 &&
      random <= 0.66 &&
      config['plugins']['streamerbot']['enabled'] === true &&
      config['plugins']['streamerbot']['youtube'] === true
    ) {
      StreamerBot['message']['youtube'](
        String(Math.random()), // message_id
        Math.floor(Math.random() * 10000000), // user_id
        username, // user_name
        message, // message
        0 // timestamp
      );
    } else if (
      random > 0.66 &&
      config['plugins']['streamerbot']['enabled'] === true &&
      config['plugins']['streamerbot']['trovo'] === true
    ) {
      StreamerBot['message']['trovo'](
        String(Math.random()), // message_id
        message, // content
        0, // timestamp
        Math.floor(Math.random() * 10000000), // userId
        username // userName
      );
    }

    remove_old_messages();
  }, 2000);
} else {
  initializeConnections();
}

if (config['version']['check'] === true && config['debug'] === false) {
  version_check().then((version) => {
    let version_el = document.getElementById('version-notice');
    let message = '';
    let display = 'none';
    let timeout = 60000;

    if (version.upToDate === false) {
      display = 'block';
      message =
        `You are using version ${STREAMCHAT_VERSION} of ${STREAMCHAT_GH_REPO}.` +
        `There is a new version available. Please update to the latest version ${version.version}.`;
    } else if (version.error) {
      display = 'block';
      message = `There was an error checking for updates. Error: ${version.error}`;
      timeout = 10000;
    }

    if (config['version']['alert'] === true && message !== '') {
      alert(message);
    } else {
      version_el.style.display = display;
      version_el.innerHTML = message;

      setTimeout(() => {
        version_el.style.display = 'none';
      }, timeout);
    }
  });
}
