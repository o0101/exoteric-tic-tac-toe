#!/bin/sh 

sudo iptables -t nat -D PREROUTING 1 || :
