const path = require('path');
const webpack = require('webpack');

module.exports = {
  mode: process.env.FE_MODE || 'development',
  entry: "./public/src/app.js",
  output: {
    path: path.join(path.resolve(__dirname), 'public'),
    filename: "bundle.js"
  },
  target: "web"
};
