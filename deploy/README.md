# Production deployment

The repository contains the application, PocketBase hooks and database
migrations. It deliberately does not contain the PocketBase executable, live
records, backups, passwords or machine-specific settings.

## First installation

1. Install Bun and Node.js on the production machine.
2. Run `./deploy/install-pocketbase.sh` on a 64-bit Linux machine. The installer
   downloads PocketBase 0.39.10 and verifies its official checksum. For another
   operating system, download that version from the official PocketBase release
   page and place the executable at `./pocketbase`.
3. Copy `.env.example` to `.env.production`. Review the public URL and storage
   paths. Add secrets only to `.env.production`; Git ignores that file.
4. Run `bun run production:prepare`.
5. Install `deploy/fact-friends.service` with systemd, then enable and start it.
   The included service matches the EdTech-a-thon path `/home/exedev/code` and
   restarts the app after a crash or reboot. On a machine using another path or
   service manager, use it as the equivalent configuration template.
6. Create the first PocketBase administrator using PocketBase's documented
   superuser command. Never commit those credentials.

The website listens on port 8000 for the exe.dev HTTPS proxy, which handles
public TLS and forwards requests to that port. PocketBase remains private on
`127.0.0.1:8090` and is reached only by the website.

## Releasing an approved update

1. Check out the exact approved Git revision on the production machine.
2. Run `bun run production:prepare`.
3. Restart the production service running `bun run production:start`.
4. Confirm the home page, teacher sign-in and one student activity work.

Preparing a release installs the locked dependency versions, creates the
website build, backs up existing PocketBase data, and then applies database
migrations. A failed install or build occurs before migration, leaving the
currently running release and its records unchanged.

## Data and rollback

`pb_data/` contains production records and must be stored on persistent disk.
`pb_backups/` contains timestamped pre-migration backups. Both directories are
private and ignored by Git. Copy backups to secure storage according to the
school's data-retention policy.

Application rollback means checking out the previous approved revision,
building it, and restarting. If a database migration must also be reversed,
stop the services first and restore the matching private backup. Never replace
production data merely by changing Git revisions.

## systemd setup

On an EdTech-a-thon production VM, install the included service once:

```sh
sudo cp deploy/fact-friends.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now fact-friends
```

After preparing an approved update, restart it with
`sudo systemctl restart fact-friends`. Check it with
`sudo systemctl status fact-friends` before testing the public site.
