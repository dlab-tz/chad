# CHAD
CHAID system has two pieces, the backend and the frontend. The frontend is madeup of VueJS while the backend is madeup of nodeJS. The backend is using mongo DB for data storage.
## CHAID Code Repository
Frontend and backend codes are both in github under dLab repository https://github.com/dlab-tz/chad

## Downloading Frontend And Backend Source Code
The source code can be downloaded by cloning the github repository. The repository can be cloned by running below command
```sh
git clone https://github.com/dlab-tz/chad
```
## Prerequisites
To run CHAID, you will need mongoDB, npm and nodejs installed. This installation procedure will be limited to running CHAID on ubuntu (18.04), CHAID can also run on windows.

### Mongo DB Installation
Setup apt repository with below command
```sh
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 9DA31620334BD75D9DCB49F368818C72E52529D4
```
Add MongoDB APT repository url in /etc/apt/sources.list.d/mongodb.list
```sh
echo "deb [ arch=amd64 ] https://repo.mongodb.org/apt/ubuntu bionic/mongodb-org/4.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb.list
```
Update repository
```sh
sudo apt update
```
Install mongo
```sh
sudo apt install mongodb-org
sudo systemctl enable mongod
```
Use below commands to start or stop mongo DB
```sh
sudo systemctl stop mongod
sudo systemctl restart mongod
```
### Npm and Node Installation
```sh
sudo apt install nodejs
sudo apt install npm
```
`
## Building and running the frontend
The frontend comes with built files that come be deployed on a web server ready for running the frontend, these files are under gui/build, copy them to an web server to start running the frontend. 
Follow below instructions if you want to rebuild the frontend
Switch to the gui directory with below commands

```sh
cd chad/gui
```
### Then install all dependencies with below commands
```sh
npm install
```
### Then build the frontend with below commands
```sh
npm run build
```
### Built files are stored under chad/gui/build
Copy built files that are under chad/gui/build to any web server of your choice i.e apache or nginx and access the frontend with localhost/folder_name, assuming folder_name is the folder which has built files on your root directory of your web server

## Installing The Backend
The backend can be installed by running below commands
Switch to the backend directory
```sh
cd chad/backend
```
### Install backend dependencies
```sh
npm install
```
### Running the backend
To run the backend issue below command
Switch to the lib folder of the backend
```sh
cd backend/lib
```
Start the backend server
```sh
node app.js
```
The backend will be running and listening requests using port 3000

## Default Login Account
The default username is root@bmf.org and passowrd is chad. This is an admin account.

# RapidPro
To install rapidpro, follow these instructions in here http://rapidpro.github.io/rapidpro/docs/development/

# ONA Installation
The easy way to get ona up and running is to use docker.
Docker installation
```sh
sudo apt-get install docker && sudo apt-get install docker-compose
```
Download ONA source code with below command
```sh
git clone https://github.com/onaio/onadata.git
```
Run ONA Data with below commands
```sh
cd onadata 
sudo docker-compose up
```
Above command will start onadata on port 8000
Run below commands to create onadata super user account
```sh
docker exec -it onadata_web_1 bash
source /srv/.virtualenv/bin/activate
python manage.py createsuperuser
```
