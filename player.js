var Util = require('./utilities.js')
var Lobby = require('./lobby.js')

class Player {

    

    constructor(id, name, lobby){
        if(name == ""){
            name = id //TODO: generate random names
        }
        this.lobby = lobby;
        this._name = name;
        this.id = id;
        this.x = 0;
        this.y = 0;
        this.rotation = 0;
        this._color = Util.randomColor();
        this.velocity = {'x':0,'y':0} 
        this._state = Player.state.free

        //flags
        this.delta = {} // delta.<attribute> MUST correspond to player.<attribute>, otherwise updatePacket will fail
        this.delta.name = false
        this.delta.color = false

        this.lobby.playerList[id] = this;
    }

    //setters and getters
    get name(){return this._name}
    set name(val){
        this.delta.name = true
        this._name = val
    }
    get color(){return this._color}
    set color(val){
        this.delta.color = true
        this._color = val
    }
    get state(){return this._state}
    set state(val){
        if (Number.isInteger(val) && val < Object.keys(Player.state).length){
            this._state = val
        } else {
            console.log("ERROR - enum assigned to nonexistent value")
        }
    }

    //static vars
    static get speed() {return 5}
    static get state() {
        return {
            'free':0,
            'attacking':1
        };
    }

    //static events
    static onConnect(socket, name, lobby) {
        //create a new player server side
        var player = new Player(socket.id, name, lobby);
        player.registerInputHandler(socket);
        player.sendNewPlayerInit(socket);
        player.updateExistingPlayers();
        return player;
    }

    static onDisconnect(socket) {
        delete socket.lobby.playerList[socket.id]
        Util.broadcast("playerDisconnect", {id: socket.id})
    }

    registerInputHandler(socket) {
        var player = this; //declared outside of callback lambda so "this" is
                           // is  a reference to "player" , not "socket"
        socket.on('newRotation', function(rotation){
            player.rotation = rotation
            player.delta.rotation = true
        })

        socket.on('clientRequestingAttack',function(){
            //player hit the fire button
            //for now, assume no weapon...so we punch


            //tell everyone else they are are attacking
            if (player.state == Player.state.free){
                Util.broadcast('playerAttacking',player.id)
                player.state = Player.state.attacking
                console.log(player.id," attacked")
            }
        })
        socket.on('clientMovementKeyChange', function(data) {
           // data is a dictionary of keycodes
           // we need to conver that into a direction
            var direction = -1
            if (data[87]){
                //up
                direction = 2
                if(data[68]){
                    //right
                    direction--
                }
                else if (data[65]){
                    //left
                    direction++
                }
            }
            else if (data[83]){
                //down
                direction = 6
                if(data[68]){
                    //right
                    direction++
                }
                else if (data[65]){
                    //left
                    direction--
                }
            }
            else{
                 if (data[65]){
                    //left 
                    direction = 4
                }
                else if (data[68]){
                    //right
                    direction = 0
                } else {

                    //client is not moving
                    player.velocity.x = 0
                    player.velocity.y = 0
                    return
                }
            }

            //now cover that number into x,y coords
            var x = Math.cos(direction*Math.PI/4)
            var y = -Math.sin(direction*Math.PI/4)
            player.velocity.x = x
            player.velocity.y = y

        });
    }

    //sends "per request" information to a new player to catch them up
    //with stuff already happenign in the game
    updateExistingPlayers(){
        //send existing players my info
        var initPackages = {}
        initPackages[this.id] = this.updatePacket(true)
        Util.broadcast("newPlayer", initPackages);
    }

    sendNewPlayerInit(socket) {
        //give the new player, this, the information about other players
        var initPackages = {}
        for(var i in this.lobby.playerList){
            var player = this.lobby.playerList[i]
            initPackages[player.id] = player.updatePacket(true)
        }
        socket.emit("newPlayer", initPackages)
    }

    static idToName(id){
        var player = Lobby.getPlayerFromId(id);
        if (player == undefined){
            return id
        }
        return player.name
    }

    move(){
        var speed = Player.speed
        this.x += this.velocity.x * speed
        this.y += this.velocity.y * speed
        this.lobby.onPlayerMoved(this);
    }

    updatePacket(ignoreDeltas = false) {
        var pack = {
            id: this.id,
            x: this.x,
            y: this.y,
            rotation: this.rotation
        };
        for (var d in this.delta){
            if (this.delta[d] || ignoreDeltas ){
                pack[d] = this[d]
            }
        }
        return pack
    }
}

module.exports = Player;