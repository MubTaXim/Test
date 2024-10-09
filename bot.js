const mineflayer = require('mineflayer');
const express = require('express');
const Movements = require('mineflayer-pathfinder').Movements;
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const { GoalBlock, GoalXZ } = require('mineflayer-pathfinder').goals;

const config = require('./settings.json');
const loggers = require('./logging.js');
const logger = loggers.logger;
const app = express();

app.get('/', (req, res) => {
    const currentUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    res.send('Your Bot Is Ready! Subscribe My Youtube: <a href="https://youtube.com/@H2N_OFFICIAL?si=UOLwjqUv-C1mWkn4">H2N OFFICIAL</a><br>Link Web For Uptime: <a href="' + currentUrl + '">' + currentUrl + '</a>');
});

app.listen(3000);

function createBot() {
    const bot = mineflayer.createBot({
        username: config['bot-account']['username'],
        password: config['bot-account']['password'],
        auth: config['bot-account']['type'],
        host: config.server.ip,
        port: config.server.port,
        version: config.server.version,
    });

    bot.loadPlugin(pathfinder);
    const mcData = require('minecraft-data')(bot.version);
    const defaultMove = new Movements(bot, mcData);
    bot.settings.colorsEnabled = false;
    bot.pathfinder.setMovements(defaultMove);

    bot.once('spawn', () => {
        logger.info("Bot joined the server");

        // Auto-authentication feature
        let isAuthenticated = false;

        // Remove the chat message listener
        // bot.on('message', (message) => {
        //     if (message.toString().includes('Logged in') || message.toString().includes('Already registered')) {
        //         isAuthenticated = true;
        //     }
        // });

        if (config.utils['auto-auth'].enabled && !isAuthenticated) {
            logger.info('Started auto-auth module');

            let password = config.utils['auto-auth'].password;
            setTimeout(() => {
                bot.chat(`/register ${password} ${password}`);
                bot.chat(`/login ${password}`);
            }, 500);

            logger.info(`Authentication commands executed`);
        }

        // Movement to target position
        const pos = config.position;
        if (config.position.enabled) {
            logger.info(`Starting moving to target location (${pos.x}, ${pos.y}, ${pos.z})`);
            bot.pathfinder.setGoal(new GoalBlock(pos.x, pos.y, pos.z));
        }

        // Anti-AFK feature
        if (config.utils['anti-afk'] && config.utils['anti-afk'].enabled) {
            if (config.utils['anti-afk'].sneak) {
                bot.setControlState('sneak', true);
            }

            if (config.utils['anti-afk'].jump) {
                bot.setControlState('jump', true);
            }

            if (config.utils['anti-afk']['hit'] && config.utils['anti-afk']['hit'].enabled) {
                let delay = config.utils['anti-afk']['hit'].delay;
                let attackMobs = config.utils['anti-afk']['hit'].attackMobs;

                setInterval(() => {
                    if (attackMobs) {
                        let entity = bot.nearestEntity(e => e.type !== 'object' && e.type !== 'player'
                            && e.type !== 'global' && e.type !== 'orb' && e.type !== 'other');

                        if (entity) {
                            bot.attack(entity);
                            return;
                        }
                    }
                    bot.swingArm('right', true);
                }, delay);
            }

            if (config.utils['anti-afk'].rotate) {
                setInterval(() => {
                    bot.look(bot.entity.yaw + 1, bot.entity.pitch, true);
                }, 100);
            }

            if (config.utils['anti-afk']['circle-walk'] && config.utils['anti-afk']['circle-walk'].enabled) {
                let radius = config.utils['anti-afk']['circle-walk'].radius;
                circleWalk(bot, radius);
            }
        }
    });

    bot.on('goal_reached', () => {
        if (config.position.enabled) {
            logger.info(`Bot arrived to target location. ${bot.entity.position}`);
        }
    });

    bot.on('death', () => {
        logger.warn(`Bot has died and respawned at ${bot.entity.position}`);
    });

    if (config.utils['auto-reconnect']) {
        bot.on('end', () => {
            setTimeout(() => {
                createBot();
            }, config.utils['auto-reconnect-delay']);
        });
    }

    bot.on('kicked', (reason) => {
        try {
            let reasonText = JSON.parse(reason).text || JSON.parse(reason).extra[0].text;
            reasonText = reasonText.replace(/§./g, '');
            logger.warn(`Bot was kicked from the server. Reason: ${reasonText}`);
        } catch (error) {
            logger.error('Failed to parse kick reason');
        }
    });

    bot.on('error', (err) => {
        logger.error(`${err.message}`);
    });
}

function circleWalk(bot, radius) {
    let angle = 0;
    setInterval(() => {
        const x = bot.entity.position.x + radius * Math.cos(angle);
        const z = bot.entity.position.z + radius * Math.sin(angle);
        bot.pathfinder.setGoal(new GoalXZ(x, z));

        angle += Math.PI / 8; // Adjust for smoother or sharper circle
    }, 1000);
}

createBot();
