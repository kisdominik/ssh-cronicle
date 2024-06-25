#!/usr/bin/env node
// SSH Command Runner Plugin for Cronicle

// Copyright (C) 2024 Dominik Kis

// Dependencies: sshpass (ensure it's installed on your system)

const fs = require('fs');
const { exec } = require('child_process');
const JSONStream = require('pixl-json-stream');

const IPV4REGEX = new RegExp('^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$');

process.stdin.setEncoding('utf8');
process.stdout.setEncoding('utf8');

const stream = new JSONStream(process.stdin, process.stdout);
stream.on('json', function(job) {
    const params = job.params;

    if (!IPV4REGEX.test(params.switch_ip)) {
        stream.write({ complete: 1, code: 1, description: "Supplied Switch IP is not a valid IPv4 address." });
        return;
    }
    
    const switch_ip = params.switch_ip;
    const username = params.username;
    const password = params.password;
    const commands = params.commands;

    const scriptContent = `
#!/bin/sh

SWITCH_IP=${switch_ip}
SWITCH_USER=${username}
SWITCH_PASSWORD=${password}
COMMANDS=$(cat <<EOF
${commands}
EOF
)

sshpass -p "$SWITCH_PASSWORD" ssh -tt -o KexAlgorithms=+diffie-hellman-group14-sha1 -o HostKeyAlgorithms=+ssh-rsa -o StrictHostKeyChecking=no "$SWITCH_USER@$SWITCH_IP" << EOF
$COMMANDS
EOF
`;

    // Write the script to a temporary file
    const scriptPath = '/tmp/run_switch_commands.sh';
    fs.writeFileSync(scriptPath, scriptContent, { mode: 0o700 });

    // Execute the script
    exec(`sh ${scriptPath}`, (error, stdout, stderr) => {
        if (error) {
            stream.write({ complete: 1, code: 1, description: `Error: ${stderr}` });
            return;
        }
        stream.write({ complete: 1, code: 0, description: `Output: ${stdout}` });
    });
});

// Meta information for the plugin
if (require.main === module) {
    console.log(JSON.stringify({
        "name": "Switch Command Runner",
        "version": "1.0",
        "description": "Runs commands on a network switch",
        "author": "Your Name",
        "category": "Utilities",
        "params": [
            { "name": "switch_ip", "type": "string", "title": "Switch IP Address", "description": "The IP address of the switch" },
            { "name": "username", "type": "string", "title": "Username", "description": "The SSH username" },
            { "name": "password", "type": "string", "title": "Password", "description": "The SSH password" },
            { "name": "commands", "type": "string", "title": "Commands", "description": "The commands to run on the switch", "format": "textarea" }
        ]
    }));
}


