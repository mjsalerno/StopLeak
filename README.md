# StopLeak   [![Build Status](http://ip.roofis0.net:666/buildStatus/icon?job=cse509)](http://ip.roofis0.net:666/job/cse509)
Detect and alert users to a personally identifiable information (PII) leak.

# Building

- install npm

## From Terminal
- ```$ npm install bower grunt grunt-cli -g```
- ```$ npm install```
- ```$ bower install```
- ```$ grunt build```

## Next

- Navigate to Chrome extension menu: chrome://extensions
- Select load unpacked extension.
- Load the StopLeak/app/ directory.
- Accept our self-signed certificate (through Chrome): https://ip.roofis0.net:667

**NOTE**: This is optional. The extension will work fine without the server connection. The only functionality lost is the setting and viewing of third-party origin statistics (number of times blocked, scrubbed, or allowed).
