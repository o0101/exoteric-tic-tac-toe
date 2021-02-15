#!/usr/bin/env bash

rm -rf public/src/web_modules
mkdir -p public/src/web_modules
cp -r node_modules/exoteric public/src/web_modules/
npm run pack
