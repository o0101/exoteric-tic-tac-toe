#!/bin/sh 

sudo iptables -t nat -D PREROUTING 1 
sudo iptables -t nat -A PREROUTING -p tcp --dport 443 -j REDIRECT --to-port 8000

