#!/bin/sh

SCRIPT_DIR=$(pwd)
WORK_DIR=$(dirname $(pwd))/shuoshuo-player
OUTPUT_DIR=$(dirname $(pwd))/dist

if [ ! -d $WORK_DIR ]; then
  echo "$WORK_DIR not exists!";
  exit;
fi

if ! which "zip" >/dev/null 2>&1; then
  echo "\"zip\" not exists";
  exit;
fi

if [ ! -d $OUTPUT_DIR ]; then
  mkdir $OUTPUT_DIR;
fi

cd $WORK_DIR

yarn build

"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --pack-extension="$WORK_DIR/build" --pack-extension-key="$SCRIPT_DIR/build.pem"

mv $WORK_DIR/build.crx $OUTPUT_DIR/shuoshuo-player.crx