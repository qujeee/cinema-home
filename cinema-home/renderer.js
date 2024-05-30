


const video = document.getElementById('video');
const mainImage = document.getElementById('main-image');
const breakImage = document.getElementById('break-image');
const welcomeImage = document.getElementById('welcome-image');

const yaml = require('js-yaml');
const fs   = require('fs');
const axios = require('axios');
const { ipcRenderer } = require('electron');



let doc;

function waitForDir() {
    return new Promise((resolve) => {
        ipcRenderer.on('dir', (_event, arg) => {
            resolve(arg);
        });
    });
}

var dir = '';




waitForDir().then((newDir) => {
    try {
        dir = newDir
        doc = yaml.load(fs.readFileSync(dir + '/config.yml', 'utf8'));
        document.getElementById("main-image").src = dir + '/images/' + doc.mainImage;
        document.getElementById("break-image").src = dir + '/images/' + doc.breakImage;
    } catch (error) {
        console.log(error);
        document.getElementById("main-image").style.visibility  = 'hidden';
        document.getElementById("break-image").style.visibility = 'hidden';
        require('dns').lookup(require('os').hostname(), function (err, add, fam) {
            document.getElementById("ip").innerText = 'Visit http://' + add.toString();
        })
       
        welcomeImage.style.visibility = 'visible';
        welcomeImage.style.opacity = 1;
    }
});
    



var playlist = [
];

let currentVideoIndex = 0;
let movieIndex = 0;
let isPlaying = false;
var middleDetected = false;

function loadVideo(index) {
    video.src = playlist[index].c;
    video.load();
}

function hideVideo(hide) {
    if (hide) {
        video.style.visibility = 'hidden';
    } else {
        video.style.visibility = 'visible';
    }
}

function hideBreakImage(hide) {
    if (hide) {
        breakImage.style.opacity = 0;
        setTimeout(() => {
            breakImage.style.visibility = 'hidden';
        }, 4000);
    } else {
        breakImage.style.visibility = 'visible';
        breakImage.style.opacity = 1;
    }
}


function playPlaylist(movieUrl) {
        try {
            playlist = doc.sequence.map(obj => ({...obj}));
            for (let i = 0; i < playlist.length; i++) {
                if (playlist[i].c === "commercials") {
                    const commercialHA = playlist[i].HA;
                    loadRandomFiles(dir + '/commercials', doc.commercialAmount).then((files) => {
                        playlist.splice(i, 1);
                        files.forEach((file, index) => {
                            playlist.splice(i + index, 0, index === 0 ? {c: dir + '/commercials/' + file, HA: commercialHA} : {c: dir + '/commercials/' + file});
                        });
                       
                    });
                } else if (playlist[i].c === "trailers") {
                    const trailerHA = playlist[i].HA;
                    loadRandomFiles(dir + '/trailers', doc.trailerAmount).then((files) => {
                        playlist.splice(i, 1);
                        files.forEach((file, index) => {
                            playlist.splice(i + index, 0, index === 0 ? {c: dir + '/trailers/' + file, HA: trailerHA} : {c: dir + '/trailers/' + file});
                        });
                       
                    });
                } else if (playlist[i].c === "movie") {
                    playlist[i].c = movieUrl;
                    movieIndex = i;
                    
                } else {
                    playlist[i].c = dir + `/videos/${playlist[i].c}`;
                }
                
            }
            isPlaying = true;
            middleDetected = false;
            hideVideo(false)
            mainImage.style.visibility = 'hidden';
            hideBreakImage(true);
            currentVideoIndex = 0;
            loadVideo(currentVideoIndex);
            video.play();
          } catch (e) {
            console.log(e);
          }
          
        
}

function detectMiddle() {
    const currentTime = video.currentTime;
    const duration = video.duration;

    // Check if the video has a valid duration
    if (duration > 0) {
        const middleTime = duration / 2;

        // Allow some tolerance around the exact middle
        const tolerance = 2;
        if (!middleDetected && currentTime >= (middleTime - tolerance) && currentTime <= (middleTime + tolerance)) {
            try {
                if (yaml.load(fs.readFileSync(dir + '/config.yml', 'utf8')).autoBreak) {
                    middleDetected = true;
                    video.pause();
                    hideVideo(true);
                    hideBreakImage(false);
                    video.currentTime -= 30;
                }
            } catch (error) {
                console.log(error);
            }
        }
    }
    
}

async function callHAScript(script)  {
    const response = await axios.post(`${doc.homeAssistantDomain}/api/services/script/${script}`, {}, {
        headers: {
            'Authorization': `Bearer ${doc.homeAssistantAPIKey}`,
            'Content-Type': 'application/json'
        },
        
    });
}

video.addEventListener('play', async () => {
    const script = playlist[currentVideoIndex].HA;
    if (script && script !== "") {
        callHAScript(script);
    }
} );


video.addEventListener('ended', () => {
    video.removeEventListener('timeupdate', detectMiddle);
    currentVideoIndex++;
    if (currentVideoIndex < playlist.length) {
        loadVideo(currentVideoIndex);
        video.play();
        if (currentVideoIndex === movieIndex) {
            video.addEventListener('timeupdate', detectMiddle );
            
        }
        
    } else {
        isPlaying = false;
        hideVideo(true)
        mainImage.style.visibility = 'visible';
        callHAScript(doc.endHAScript);
    }
});

function toggleBreak() {
    if (breakImage.style.visibility === 'hidden') {
        video.pause();
        hideVideo(true);
        hideBreakImage(false);
        video.currentTime -= 30;
        const script = doc.breakHAScript;
        if (script && script !== "") {
            callHAScript(script);
        }
        
    } else {
        
            hideBreakImage(true);
            setTimeout(() => {
                if (isPlaying) {

                video.play();
                }
                hideVideo(false);
            }, 4000);
        
    }
}


ipcRenderer.on('start-movie', (_event, arg) => {
    playPlaylist(arg);
 });

ipcRenderer.on('toggle-break', (_event, arg) => {
    toggleBreak();
});

ipcRenderer.on('rewind-15', (_event, arg) => {
   video.currentTime -= 15;
});

ipcRenderer.on('forward-15', (_event, arg) => {
    video.currentTime += 15;
 });



ipcRenderer.on('skip', (_event, arg) => {
    if (isPlaying) {
        currentVideoIndex++;
        if (currentVideoIndex < playlist.length) {
            loadVideo(currentVideoIndex);
            video.play();
        } else {
            isPlaying = false;
            video.pause();
            hideVideo(true)
            mainImage.style.visibility = 'visible';
        }
    }
    
});

function getFilesFromDirectory(directoryPath) {
    return new Promise((resolve, reject) => {
      fs.readdir(directoryPath, (err, files) => {
        if (err) {
          return reject(err);
        }
        resolve(files);
      });
    });
  }
  
  // Function to shuffle an array
  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

// Quit on ESC key for 5 seconds
let escKeyHeld = false;
let escKeyTimer;

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !escKeyHeld) {
      escKeyHeld = true;
      escKeyTimer = setTimeout(() => {
        ipcRenderer.send('quit-app');
      }, 5000);
    }
    if (event.key == 'i') {
        ipcRenderer.send('open-devtools')
    }
  });
  
  document.addEventListener('keyup', (event) => {
    if (event.key === 'Escape') {
      clearTimeout(escKeyTimer);
      escKeyHeld = false;
    }
  });

  async function loadRandomFiles(directoryPath, amount) {
    try {
      // Get the list of files
      const files = await getFilesFromDirectory(directoryPath);
      
      // Shuffle the list of files
      const shuffledFiles = shuffleArray(files);
      
      // Select the first 3 files
      const randomFiles = shuffledFiles.slice(0, amount);
  
      // Read the contents of the selected files

  
  
      // Return the file names and their contents
      return randomFiles.map((file, index) => (file));
    } catch (error) {
      console.error('Error loading random files:', error);
    }
  };