'use strict';

/*
 * Created with @iobroker/create-adapter v1.23.0
 */

const utils = require('@iobroker/adapter-core');
const {execSync} = require('child_process');

let tmr_EQ3Update = null;

// Used as eq3cli backend (bleak, bluepy, gattlib)
let ADAPTER = 'bluepy';

class Eq3Thermostat extends utils.Adapter {
    /**
     * @param {Partial<ioBroker.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: 'eq3-thermostat',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('objectChange', this.onObjectChange.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        let bPreCheckErr = false;

        this.log.info('##### LOAD CONFIG ##### ');
        if (!this.config.getEQ3Devices.length) {
            this.log.info('## No Devices created, only Path-Check available');
            bPreCheckErr = true;
        }
        if (isNaN(this.config.inp_refresh_interval)) {
            this.config.inp_refresh_interval = 5;
            this.log.info('Update-Interval overwritten to: ' + this.config.inp_refresh_interval);
        }
        if (!parseFloat(this.config.inp_button_step_size)) {
            this.config.inp_button_step_size = 1.0;
            this.log.info('Button step overwritten to: ' + this.config.inp_button_step_size);
        }
        this.log.info('Force Mode-Manual: ' + this.config.inp_override_modemanual);

        if (this.config.inp_eq3Controller_path.length == 0) {
            this.log.info('## eq3cli path empty, only Path-Check available');
            bPreCheckErr = true;
        }

        this.log.info('Loaded ' + this.config.getEQ3Devices.length + ' eq3-Devices');
        this.log.info('Update-Interval: ' + this.config.inp_refresh_interval);
        this.log.info('Button step: ' + this.config.inp_button_step_size);
        this.log.info('eq3cli path: "' + this.config.inp_eq3Controller_path + '"');

        this.log.info('##### CREATE OBJECTS ##### ');
        if (this.config.getEQ3Devices.length) {
            for (let nDev = 0; nDev < this.config.getEQ3Devices.length; nDev++) {
                const sDevMAC = this.config.getEQ3Devices[nDev].eq3MAC;

                await this.setObjectNotExists(sDevMAC, {
                    type: 'device',
                    common: {name: sDevMAC},
                    native: {},
                });
                await this.setObjectNotExists(sDevMAC + '.temperature', {
                    type: 'state',
                    common: {
                        name: 'temperature',
                        role: 'level.temperature',
                        read: true,
                        write: true,
                        type: 'number',
                        unit: '°C',
                        min: 5,
                        max: 30,
                    },
                    native: {},
                });
                await this.setObjectNotExists(sDevMAC + '.day', {
                    type: 'state',
                    common: {
                        name: 'day',
                        role: 'value.temperature',
                        read: true,
                        write: true,
                        type: 'number',
                        unit: '°C',
                        min: 5,
                        max: 30,
                    },
                    native: {},
                });
                await this.setObjectNotExists(sDevMAC + '.night', {
                    type: 'state',
                    common: {
                        name: 'night',
                        role: 'value.temperature',
                        read: true,
                        write: true,
                        type: 'number',
                        unit: '°C',
                        min: 5,
                        max: 30,
                    },
                    native: {},
                });
                await this.setObjectNotExists(sDevMAC + '.valve', {
                    type: 'state',
                    common: {
                        name: 'valve',
                        role: 'level',
                        read: true,
                        write: false,
                        type: 'number',
                        unit: '%',
                        min: 0,
                        max: 100,
                    },
                    native: {},
                });
                await this.setObjectNotExists(sDevMAC + '.low_battery_alarm', {
                    type: 'state',
                    common: {
                        name: 'low_battery_alarm',
                        role: 'indicator',
                        read: true,
                        write: false,
                        type: 'boolean',
                    },
                    native: {},
                });
                await this.setObjectNotExists(sDevMAC + '.no_connection', {
                    type: 'state',
                    common: {
                        name: 'no_connection',
                        role: 'indicator',
                        read: true,
                        write: false,
                        type: 'boolean',
                    },
                    native: {},
                });
                await this.setObjectNotExists(sDevMAC + '.last_cmd_failed', {
                    type: 'state',
                    common: {
                        name: 'last_cmd_failed',
                        role: 'indicator',
                        read: true,
                        write: false,
                        type: 'boolean',
                    },
                    native: {},
                });
                await this.setObjectNotExists(sDevMAC + '.name', {
                    type: 'state',
                    common: {
                        name: 'name',
                        role: 'text',
                        read: true,
                        write: false,
                        type: 'string',
                    },
                    native: {},
                });
                await this.setObjectNotExists(sDevMAC + '.plus', {
                    type: 'state',
                    common: {
                        name: 'plus',
                        role: 'button',
                        read: true,
                        write: true,
                        type: 'boolean',
                    },
                    native: {},
                });
                await this.setObjectNotExists(sDevMAC + '.minus', {
                    type: 'state',
                    common: {
                        name: 'minus',
                        role: 'button',
                        read: true,
                        write: true,
                        type: 'boolean',
                    },
                    native: {},
                });
                await this.setObjectNotExists(sDevMAC + '.boost', {
                    type: 'state',
                    common: {
                        name: 'boost',
                        role: 'switch',
                        read: true,
                        write: true,
                        type: 'boolean',
                    },
                    native: {},
                });
                await this.setObjectNotExists(sDevMAC + '.manual_interaction', {
                    type: 'state',
                    common: {
                        name: 'manual_interaction',
                        role: 'switch',
                        read: true,
                        write: false,
                        type: 'boolean',
                        def: false,
                    },
                    native: {},
                });
            }
        }

        await this.setObjectNotExists('heating_season', {
            type: 'state',
            common: {
                name: 'heating_season',
                role: 'switch',
                read: true,
                write: true,
                type: 'boolean',
            },
            native: {},
        });
        await this.setObjectNotExists('limit_outdoor_temperature', {
            type: 'state',
            common: {
                name: 'limit_outdoor_temperature',
                role: 'value.temperature',
                read: true,
                write: true,
                type: 'number',
                unit: '°C',
            },
            native: {},
        });

        // ID bleibt "hci", inhaltlich ist es jetzt der eq3cli backend
        await this.setObjectNotExists('hci', {
            type: 'state',
            common: {
                name: 'backend',
                role: 'config',
                read: true,
                write: true,
                type: 'string',
                def: ADAPTER,
            },
            native: {},
        });
        const state = await this.getStateAsync('hci');
        if (state && state.val != null) ADAPTER = state.val.toString();

        this.log.info('Backend (eq3cli --backend): ' + ADAPTER);

        this.log.info('##### RUN ADAPTER ##### ');
        if (!bPreCheckErr) {
            this.fEQ3Update();
        } else {
            this.log.info('##### PRE CHECK ERRORS, MAIN FUNCTIONS DISABLED! Check Settings');
        }

        this.subscribeStates('*');
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            if (tmr_EQ3Update) {
                clearTimeout(tmr_EQ3Update);
                tmr_EQ3Update = null;
            }
            this.log.info('cleaned everything up...');
            callback();
        } catch (e) {
            callback();
        }
    }

    /**
     * Is called if a subscribed object changes
     * @param {string} id
     * @param {ioBroker.Object | null | undefined} obj
     */
    onObjectChange(id, obj) {
        if (obj) {
            this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
        } else {
            this.log.info(`object ${id} deleted`);
        }
    }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state) {
            if (state.from !== 'system.adapter.' + this.namespace) {
                const aState = id.split('.');
                const stateName = aState[aState.length - 1].toString();
                const updateStep = parseFloat(this.config.inp_refresh_interval); // unverändert zum Original
                if (stateName === 'temperature') {
                    this.log.info(id + ' changed from ' + state.from);
                    const sTmrName = 'tmr_' + aState[aState.length - 2];
                    if (global[sTmrName]) {
                        clearTimeout(global[sTmrName]);
                    }
                    global[sTmrName] = setTimeout(
                        this.fSetTemp.bind(this, aState[aState.length - 2], state.val),
                        8000
                    );
                } else if (stateName === 'plus') {
                    state.val = state.val + updateStep;
                } else if (stateName === 'minus') {
                    state.val = state.val - updateStep;
                } else if (stateName === 'boost') {
                    this.fSetBoost(aState[aState.length - 2], state.val);
                }
            }
        } else {
            // state deleted
        }
    }

    /**
     * Messages from admin (path check, device scan)
     * @param {ioBroker.Message} obj
     */
    onMessage(obj) {
        if (typeof obj === 'object') {
            if (obj.command === 'checkEQ3Path') {
                const bCMDRes = this.fCheckLiveEQ3Controller(obj.message.EQ3Path);
                if (obj.callback) this.sendTo(obj.from, obj.command, bCMDRes.toString(), obj.callback);
            }
            if (obj.command === 'findDevices') {
                try {
                    var stdout = execSync('timeout -s INT 8s stdbuf -oL hcitool lescan')
                        .toString()
                        .replace(new RegExp('\r?\n', 'g'), '<br>');
                } catch (e) {
                    var stdout = 'Error: ' + e.stdout.toString().replace(new RegExp('\r?\n', 'g'), '<br>');
                }
                const aMacFound = stdout.split('<br>');
                let sOut = '';
                for (const val of aMacFound) {
                    if (val.indexOf('CC-RT-BLE') > -1) {
                        sOut = sOut + val + '<br>';
                    }
                }
                if (obj.callback) this.sendTo(obj.from, obj.command, sOut.toString(), obj.callback);
            }
        }
    }

    /**
     * Simple check if eq3cli is callable
     * @param {string} sPath
     */
    fCheckLiveEQ3Controller(sPath) {
        try {
            const stdout = execSync(sPath + ' --help').toString();
            this.log.debug('PathCheck-Result: ' + stdout);
            if (stdout.indexOf('Usage: eq3cli') > -1) {
                this.log.info('check successful! eq3cli found.');
                return true;
            } else {
                this.log.info("check failed! Response doesn't match expected eq3cli output");
                this.log.info('check failed! Response: ' + stdout);
                return false;
            }
        } catch (e) {
            this.log.info('check failed! eq3cli call threw an error');
            this.log.info('check failed! Response: ' + e);
            return false;
        }
    }

    /**
     * Busy-wait sleep
     * @param {number} milliseconds
     */
    sleep(milliseconds) {
        const date = Date.now();
        let currentDate = null;
        do {
            currentDate = Date.now();
        } while (currentDate - date < milliseconds);
    }

    /**
     * Parse eq3cli state output into values
     * @param {string} output
     */
    parseEq3cliState(output) {
        const result = {
            temperature: null,
            valve: null,
            lowBattery: null,
            boost: null,
            manual: null,
            comfortTemp: null,
            ecoTemp: null,
        };

        const lines = output.split(/\r?\n/);
        for (const raw of lines) {
            const line = raw.trim();
            if (!line) continue;

            if (line.startsWith('Current target temp:')) {
                const m = line.match(/Current target temp:\s*([0-9]+(?:\.[0-9])?)/i);
                if (m) result.temperature = parseFloat(m[1]);
            } else if (line.startsWith('Valve:')) {
                const m = line.match(/Valve:\s*([0-9]+)/i);
                if (m) result.valve = parseInt(m[1], 10);
            } else if (line.toLowerCase().startsWith('batter low:') || line.toLowerCase().startsWith('battery low:')) {
                const m = line.match(/low:\s*(true|false)/i);
                if (m) result.lowBattery = m[1].toLowerCase() === 'true';
            } else if (line.startsWith('Boost:')) {
                const m = line.match(/Boost:\s*(true|false)/i);
                if (m) result.boost = m[1].toLowerCase() === 'true';
            } else if (line.startsWith('Current mode:')) {
                result.manual = line.toLowerCase().indexOf('manual') !== -1;
            } else if (line.startsWith('Current comfort temp:')) {
                const m = line.match(/Current comfort temp:\s*([0-9]+(?:\.[0-9])?)/i);
                if (m) result.comfortTemp = parseFloat(m[1]);
            } else if (line.startsWith('Current eco temp:')) {
                const m = line.match(/Current eco temp:\s*([0-9]+(?:\.[0-9])?)/i);
                if (m) result.ecoTemp = parseFloat(m[1]);
            }
        }

        return result;
    }

    /**
     * Periodic polling via eq3cli
     */
    fEQ3Update() {
        if (this.config.getEQ3Devices.length) {
            tmr_EQ3Update = setTimeout(() => this.fEQ3Update(), this.config.inp_refresh_interval * 60000);

            const sPath = this.config.inp_eq3Controller_path;

            for (let nDev = 0; nDev < this.config.getEQ3Devices.length; nDev++) {
                const sDevMAC = this.config.getEQ3Devices[nDev].eq3MAC;
                const sDevName = this.config.getEQ3Devices[nDev].eq3Name;

                if (nDev > 0) {
                    this.sleep(1000);
                }

                try {
                    let stdout;
                    try {
                        const cmd = `${sPath} --mac ${sDevMAC} --backend ${ADAPTER} state`;
                        this.log.debug(cmd);
                        stdout = execSync(cmd).toString();
                    } catch (e) {
                        this.log.error('Connection or command failed for MAC: ' + sDevMAC);
                        this.log.debug('eq3cli error: ' + e);
                        this.setStateAsync(sDevMAC + '.no_connection', {val: true, ack: true});
                        continue;
                    }

                    const parsed = this.parseEq3cliState(stdout);

                    if (parsed.temperature == null || parsed.valve == null) {
                        this.log.error('Could not parse expected values from eq3cli state for MAC: ' + sDevMAC);
                        this.log.debug('eq3cli output:\n' + stdout);
                        this.setStateAsync(sDevMAC + '.no_connection', {val: true, ack: true});
                        continue;
                    }

                    if (this.config.inp_override_modemanual) {
                        if (parsed.manual === false) {
                            this.log.info(
                                'Wrong Mode detected, changing to Manual-Mode for Device: "' + sDevMAC + '" '
                            );
                            try {
                                const cmdManual = `${sPath} --mac ${sDevMAC} --backend ${ADAPTER} mode manual`;
                                execSync(cmdManual);
                            } catch (e) {
                                this.log.warn('Failed to set manual mode for ' + sDevMAC + ': ' + e);
                            }
                        }
                    }

                    const aValues = [
                        parsed.temperature, // 0 = Temperature
                        parsed.valve, // 1 = Valve
                        parsed.lowBattery || false, // 2 = LowBatteryAlarm
                        false, // 3 = NoConnection
                        parsed.boost || false, // 4 = Boost
                    ];
                    this.fUpdateDevObj(aValues, sDevMAC, sDevName);

                    if (parsed.comfortTemp != null) {
                        this.setStateAsync(sDevMAC + '.day', {val: parsed.comfortTemp, ack: true});
                    }
                    if (parsed.ecoTemp != null) {
                        this.setStateAsync(sDevMAC + '.night', {val: parsed.ecoTemp, ack: true});
                    }
                } catch (e) {
                    this.log.error('Could not get Values for Device: "' + sDevMAC + '" ');
                    this.log.error('-----------"' + e);
                    this.setStateAsync(sDevMAC + '.no_connection', {val: true, ack: true});
                }
            }
        } else {
            clearTimeout(tmr_EQ3Update);
            tmr_EQ3Update = null;
        }
    }

    /**
     * Update ioBroker states from parsed values
     */
    fUpdateDevObj(aDevValues, sDevMAC, sDevName) {
        this.setStateAsync(sDevMAC + '.temperature', {val: aDevValues[0], ack: true});
        this.setStateAsync(sDevMAC + '.valve', {val: aDevValues[1], ack: true});
        this.setStateAsync(sDevMAC + '.low_battery_alarm', {val: aDevValues[2], ack: true});
        this.setStateAsync(sDevMAC + '.no_connection', {val: aDevValues[3], ack: true});
        this.setStateAsync(sDevMAC + '.name', {val: sDevName, ack: true});
        this.setStateAsync(sDevMAC + '.boost', {val: aDevValues[4], ack: true});
    }

    /**
     * Set target temperature via eq3cli temp
     * @param {string} sDevMAC
     * @param {number} sTemp
     */
    /**
     * Set target temperature via eq3cli temp
     * @param {string} sDevMAC
     * @param {number} sTemp
     */
    fSetTemp(sDevMAC, sTemp) {
        this.log.info('Set ' + sTemp + '°C on Device  ' + sDevMAC);
        const sPath = this.config.inp_eq3Controller_path;
        const retries = 3;
        let success = false;
        let lastError = null;

        for (let i = 0; i < retries; i++) {
            try {
                const cmd = `${sPath} --mac ${sDevMAC} --backend ${ADAPTER} temp --target ${sTemp}`;
                const stdout = execSync(cmd).toString();
                this.log.info('Command result: ' + stdout);
                success = true;
                break;
            } catch (e) {
                lastError = e;
                // nur Debug-Log für Zwischenversuche
                this.log.debug('eq3cli temp failed for MAC ' + sDevMAC + ' (try ' + (i + 1) + ' of ' + retries + '): ' + e);
            }
            this.sleep(1000);
        }

        if (!success) {
            // erst jetzt ein echter Fehler, wenn alle Versuche fehlgeschlagen sind
            this.log.error('Command temp failed for MAC ' + sDevMAC + ' after ' + retries + ' retries: ' + lastError);
        }

        this.setStateAsync(sDevMAC + '.last_cmd_failed', {val: !success, ack: true});
    }

    /**
     * Set boost via eq3cli boost
     * @param {string} sDevMAC
     * @param {boolean} bON
     */
    fSetBoost(sDevMAC, bON) {
        this.log.info('Set Boost to ' + bON + ' on Device  ' + sDevMAC);
        const sPath = this.config.inp_eq3Controller_path;
        const retries = 3;
        let success = false;
        let lastError = null;

        for (let i = 0; i < retries; i++) {
            try {
                const cmd = bON
                    ? `${sPath} --mac ${sDevMAC} --backend ${ADAPTER} boost --on`
                    : `${sPath} --mac ${sDevMAC} --backend ${ADAPTER} boost --off`;
                const stdout = execSync(cmd).toString();
                this.log.info('Command result: ' + stdout);
                success = true;
                break;
            } catch (e) {
                lastError = e;
                this.log.debug('eq3cli boost failed for MAC ' + sDevMAC + ' (try ' + (i + 1) + ' of ' + retries + '): ' + e);
            }
            this.sleep(1000);
        }

        if (!success) {
            this.log.error('Command boost failed for MAC ' + sDevMAC + ' after ' + retries + ' retries: ' + lastError);
        }

        this.setStateAsync(sDevMAC + '.last_cmd_failed', {val: !success, ack: true});
    }
}

// @ts-ignore parent is a valid property on module
if (module.parent) {
    /**
     * @param {Partial<ioBroker.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new Eq3Thermostat(options);
} else {
    new Eq3Thermostat();
}
