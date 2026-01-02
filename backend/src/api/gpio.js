const express = require('express');
const router = express.Router();
const { getGPIOManager } = require('../core/gpio-manager');
const logger = require('../core/logger');

/**
 * GPIO API Routes
 * Provides REST API for GPIO control and testing
 */

// Get GPIO manager instance
const gpio = getGPIOManager();

/**
 * Initialize GPIO system
 * GET /api/gpio/init
 */
router.get('/init', async (req, res) => {
  try {
    const initialized = await gpio.initialize();
    res.json({
      success: initialized,
      pins: gpio.pins,
      message: initialized ? 'GPIO initialized successfully' : 'GPIO initialization failed'
    });
  } catch (error) {
    logger.error('GPIO init error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get pin states
 * GET /api/gpio/status
 */
router.get('/status', (req, res) => {
  try {
    const states = gpio.getPinStates();
    res.json({
      pins: gpio.pins,
      states,
      exported: Array.from(gpio.exportedPins)
    });
  } catch (error) {
    logger.error('GPIO status error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Write to GPIO pin
 * POST /api/gpio/write
 * Body: { pin: number, value: 0|1 } or { pinName: string, value: 0|1 }
 */
router.post('/write', async (req, res) => {
  try {
    let { pin, pinName, value } = req.body;

    // Resolve pin from name
    if (pinName && gpio.pins[pinName]) {
      pin = gpio.pins[pinName];
    }

    if (pin === undefined || pin === null) {
      return res.status(400).json({ error: 'Pin number or pin name required' });
    }

    if (value === undefined || value === null) {
      return res.status(400).json({ error: 'Value required (0 or 1)' });
    }

    await gpio.writePin(pin, value);

    res.json({
      success: true,
      pin,
      pinName: pinName || `GPIO${pin}`,
      value: value ? 1 : 0
    });
  } catch (error) {
    logger.error('GPIO write error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Read from GPIO pin
 * GET /api/gpio/read?pin=5 or ?pinName=PTT
 */
router.get('/read', async (req, res) => {
  try {
    let { pin, pinName } = req.query;

    // Resolve pin from name
    if (pinName && gpio.pins[pinName]) {
      pin = gpio.pins[pinName];
    }

    if (pin === undefined || pin === null) {
      return res.status(400).json({ error: 'Pin number or pin name required' });
    }

    pin = parseInt(pin);
    const value = await gpio.readPin(pin);

    res.json({
      success: true,
      pin,
      pinName: pinName || `GPIO${pin}`,
      value
    });
  } catch (error) {
    logger.error('GPIO read error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Control PTT
 * POST /api/gpio/ptt
 * Body: { action: 'on'|'off'|'pulse', duration: number }
 */
router.post('/ptt', async (req, res) => {
  try {
    const { action, duration } = req.body;

    switch (action) {
      case 'on':
      case 'activate':
        await gpio.activatePTT();
        res.json({ success: true, action: 'activated', pin: gpio.pins.PTT });
        break;

      case 'off':
      case 'deactivate':
        await gpio.deactivatePTT();
        res.json({ success: true, action: 'deactivated', pin: gpio.pins.PTT });
        break;

      case 'pulse':
        const pulseDuration = duration || 2000;
        await gpio.activatePTT();
        
        setTimeout(async () => {
          await gpio.deactivatePTT();
        }, pulseDuration);
        
        res.json({ 
          success: true, 
          action: 'pulsed', 
          duration: pulseDuration, 
          pin: gpio.pins.PTT 
        });
        break;

      default:
        res.status(400).json({ error: 'Invalid action. Use on, off, or pulse' });
    }
  } catch (error) {
    logger.error('PTT control error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Set radio channel
 * POST /api/gpio/channel
 * Body: { channel: 0-15 }
 */
router.post('/channel', async (req, res) => {
  try {
    let { channel } = req.body;

    channel = parseInt(channel);

    if (isNaN(channel) || channel < 0 || channel > 15) {
      return res.status(400).json({ error: 'Channel must be 0-15' });
    }

    await gpio.setChannel(channel);

    // Calculate CS pin states
    const cs0 = (channel & 0x01) ? 1 : 0;
    const cs1 = (channel & 0x02) ? 1 : 0;
    const cs2 = (channel & 0x04) ? 1 : 0;
    const cs3 = (channel & 0x08) ? 1 : 0;

    res.json({
      success: true,
      channel,
      csStates: { cs0, cs1, cs2, cs3 },
      pins: {
        CS0: gpio.pins.CS0,
        CS1: gpio.pins.CS1,
        CS2: gpio.pins.CS2,
        CS3: gpio.pins.CS3
      }
    });
  } catch (error) {
    logger.error('Channel select error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Control clear channel
 * POST /api/gpio/clear-channel
 * Body: { enable: true|false }
 */
router.post('/clear-channel', async (req, res) => {
  try {
    const { enable } = req.body;

    if (enable) {
      await gpio.activateClearChannel();
    } else {
      await gpio.deactivateClearChannel();
    }

    res.json({
      success: true,
      enabled: enable,
      pin: gpio.pins.CLEAR_CHANNEL
    });
  } catch (error) {
    logger.error('Clear channel error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Test sequence - cycles through channels and PTT
 * POST /api/gpio/test
 */
router.post('/test', async (req, res) => {
  try {
    res.json({ 
      success: true, 
      message: 'Test sequence started',
      note: 'Check logs for test progress'
    });

    // Run test sequence asynchronously
    (async () => {
      logger.info('Starting GPIO test sequence...');

      // Test PTT
      logger.info('Testing PTT...');
      await gpio.activatePTT();
      await gpio.sleep(1000);
      await gpio.deactivatePTT();
      await gpio.sleep(500);

      // Test channels 0, 1, 2
      for (let ch = 0; ch <= 2; ch++) {
        logger.info(`Testing channel ${ch}...`);
        await gpio.setChannel(ch);
        await gpio.sleep(1000);
      }

      // Test clear channel
      logger.info('Testing clear channel...');
      await gpio.activateClearChannel();
      await gpio.sleep(1000);
      await gpio.deactivateClearChannel();

      logger.info('GPIO test sequence complete');
    })();

  } catch (error) {
    logger.error('GPIO test error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
