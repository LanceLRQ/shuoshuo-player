const path = require('path');
const { override, addWebpackAlias, addWebpackPlugin } = require('customize-cra');
const ProgressBarPlugin = require('progress-bar-webpack-plugin');
const chalk = require('chalk');
module.exports = override(
    // 其他配置 ...,
    addWebpackPlugin(new ProgressBarPlugin({
            complete: "█",
            format: `${chalk.green('Building')} [ ${chalk.green(':bar')} ] ${chalk.bold(':percent')}`,
            clear: true
        })
    ),
    addWebpackAlias({
        '@': path.resolve(__dirname, 'src'),
        // 'components': path.resolve(__dirname, 'src/components'),
    })
)