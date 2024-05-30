// const { app, BrowserWindow } = require('electron')

// const createWindow = () => {
//   const win = new BrowserWindow({
//     fullscreen: true,
//   })
//   win.webContents.on('dom-ready', (event)=> {
//     let css = '* { cursor: none !important; }';
//     win.webContents.insertCSS(css);
//   });

//   win.loadFile('index.html')
// }

// app.whenReady().then(() => {
//   createWindow()
// })


import { app, BrowserWindow, ipcMain  } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import axios from 'axios';
import loudness from 'loudness';
import yaml from 'js-yaml';
import fs from 'fs';
import cp from 'child_process';
import schedule from 'node-schedule';

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);



import Store from 'electron-store';

const store = new Store();
const dir = store.get('dir') ?? '';



let mainWindow;

var jellyfinDomain;
var jellyfinAPIKey;


function createWindow() {
    mainWindow = new BrowserWindow({
        fullscreen: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    mainWindow.webContents.on('dom-ready', (event)=> {
        let css = '* { cursor: none !important; }';
        mainWindow.webContents.insertCSS(css);
        mainWindow.webContents.send('dir', dir);
    });
    ipcMain.on('open-devtools', (event) => {
        mainWindow.webContents.openDevTools();
      });
    mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
    
    try {
        const doc = yaml.load(fs.readFileSync(dir + '/config.yml', 'utf8'));
        jellyfinDomain = doc.jellyfinDomain;
        jellyfinAPIKey = doc.jellyfinAPIKey;
        var trailerFetchScript = doc.trailerFetchScript
        if (trailerFetchScript && fs.existsSync(dir + '/' + trailerFetchScript)) {
            cp.fork(dir + '/' + trailerFetchScript);
            schedule.scheduleJob('0 0 * * *', function() {
                cp.fork(dir + '/' + trailerFetchScript);
            });
        }
    } catch (error) {
        console.error('Error reading config.yml:', error);
    }
    
    
    
    const server = express();
    server.use(express.json(), express.static(__dirname + '/web-ui'));

    server.post('/dir', (req, res) => {
        const newDir = req.body.dir;
        store.set('dir', newDir);
        res.sendStatus(200);
        app.relaunch()
        app.exit()
    });

    server.get('/search', async (req, res) => {
        const query = req.query.query;
        try {
            const response = await axios.get(`${jellyfinDomain}/Items`, {
                params: {
                    api_key: jellyfinAPIKey,
                    searchTerm: query,
                    IncludeItemTypes: 'Movie',
                    Recursive: true,
                    Limit: 5
                }
            });
            const movies = response.data.Items;
            res.json(movies);
        } catch (error) {
            console.error('Error fetching data from Jellyfin:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    server.post('/start', async (req, res) => {
        try {
            const movieID = req.body.movieID;
            mainWindow.webContents.send('start-movie', jellyfinDomain + '/Items/' + movieID + '/Download?api_key=' + jellyfinAPIKey);
            res.sendStatus(200);
        } catch (error) {
            console.error(error);
            res.sendStatus(500);
        }
    });

    server.get('/status', async (req, res) => {
        try {
            const volume = await loudness.getVolume();
            var autoBreak = true;
            try {
                autoBreak = yaml.load(fs.readFileSync(dir + '/config.yml', 'utf8')).autoBreak;
            } catch (error) {
                console.error('Error reading config.yml:', error);
            }
            
            res.json({ volume, autoBreak, dir});
        } catch (error) {
            console.error(error);
            res.sendStatus(500);
        }
    });

    server.post('/volume', async (req, res) => {
        try {
            const volume = parseInt(req.body.volume);
            if (isNaN(volume) || volume < 0 || volume > 100) {
                return res.status(400).send('Volume must be a number between 0 and 100');
            }
    
            await loudness.setVolume(volume);
            res.sendStatus(200);
        } catch (error) {
            console.error(error);
            res.sendStatus(500);
        }
    });

    


    server.post('/break', async (req, res) => {
        try {
            mainWindow.webContents.send('toggle-break');
            res.sendStatus(200);
        } catch (error) {
            console.error(error);
            res.sendStatus(500);
        }
    });

    server.post('/rewind-15', async (req, res) => {
        try {
            mainWindow.webContents.send('rewind-15');
            res.sendStatus(200);
        } catch (error) {
            console.error(error);
            res.sendStatus(500);
        }
    });

    server.post('/forward-15', async (req, res) => {
        try {
            mainWindow.webContents.send('forward-15');
            res.sendStatus(200);
        } catch (error) {
            console.error(error);
            res.sendStatus(500);
        }
    });

    server.post('/skip', async (req, res) => {
        try {
            mainWindow.webContents.send('skip');
            res.sendStatus(200);
        } catch (error) {
            console.error(error);
            res.sendStatus(500);
        }
    });

    server.post('/auto-break', async (req, res) => {
        try {
            const { enabled } = req.body;
            let doc = yaml.load(fs.readFileSync(dir + '/config.yml', 'utf8'));
            doc.autoBreak =  enabled;
            fs.writeFile(dir + '/config.yml', yaml.dump(doc), (err) => {
                if (err) {
                    res.sendStatus(500);
                    return console.error(err);
                }
            });;
            res.sendStatus(200);
        } catch (error) {
            console.error(error);
            res.sendStatus(500);
        }
    });
    
    try {
        server.listen(80, () => {
            console.log('Server running on port 80');
        }).on('error', function(err) { console.log(err)});;
    } catch (error) {
        console.error(error);
    }
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    });
});
  

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});


ipcMain.on('quit-app', () => {
    app.quit();
});

