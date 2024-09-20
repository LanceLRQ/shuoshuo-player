const rules = require('./webpack.rules');
const CopyPlugin = require("copy-webpack-plugin");
const path = require("path");

rules.push({
  test: /\.css$/,
  use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
});

module.exports = {
  // Put your normal webpack config below here
  module: {
    rules,
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: path.join(__dirname, '../shuoshuo-player/build'), to: "build" },
      ],
    }),
  ]
};
