pkg install nodejs &&
pkg install tsu &&
npm i -g forever &&
mkdir -p $HOME/.termux/boot &&
echo "tsudo node $PREFIX/bin/forever $HOME/server_dskpl.js" > $HOME/.termux/boot/startserver &&
curl -O "https://raw.githubusercontent.com/AudioVisualDistributors/OvertureDrivers/master/scripts/prodvx_api/server_dskpl.js"