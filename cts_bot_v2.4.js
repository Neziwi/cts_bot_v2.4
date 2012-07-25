function get_first_tt_obj() {
    for (var object in turntable) {
        return object;
    }
}

function get_room_manager() {
    for (var window_var in window) {
        if (window[window_var]["become_dj"] != undefined) {
            return window[window_var];
        }
    }
}

var queue_enabled = true;
var manage_strict = false;

var first_tt_obj = get_first_tt_obj();
var my_room_manager = get_room_manager();
var my_chat = "";
var rickroll_index = 0;

var bot_owner = ["[unassigned]", ""]; // [username, user_id]
var visited_users = [];

var dj_steal_hash = [];
var dj_play_count = [];

var afk_djs = [];
var my_queue = [];
var countdown_ticks = 1;
var auto_banned = [];
var countdown_timeout_id = false;

var current_song;

var user_hash = turntable[first_tt_obj]["users"];
var dj_hash = turntable[first_tt_obj]["djIds"];

function refresh_dj_hash() {
    dj_hash = turntable[first_tt_obj]["djIds"];
}

function refresh_user_hash() {
    user_hash = turntable[first_tt_obj]["users"];
}

var temp_user_hash = {};

function set_temp_user_hash() {
    for (var user_id in user_hash) {
        temp_user_hash[user_id] = {
            "name": user_hash[user_id]["name"],
            "leave_time": 0,
            "last_active": new Date()
        };
    }
}
set_temp_user_hash();

function update_temp_user_hash(user_id, type) {
    if (type == "add") {
        // only add if not already in temp_user_hash
        for (var id in temp_user_hash) {
            if (user_id == id) {
                temp_user_hash[user_id]["leave_time"] = 0;
                return;
            }
        }
        temp_user_hash[user_id] = {
            "name": user_hash[user_id]["name"],
            "leave_time": 0,
            "last_active": new Date() - 180000
        };
    } else {
        // remove from temp_user_hash
        delete temp_user_hash[user_id];
    }
}

function set_mod(user_id) {
    my_room_manager.callback("add_moderator", user_id);
}

function countdown() {
    // first in line
    var input_message = get_username(my_queue[0], false) + " is afk. ";
    var afk_user_id = my_queue[0];
    my_queue.splice(0, 1);

    if (afk_djs.indexOf(afk_user_id) == -1) {
        // wasnt afk before, so insert at position 1
        afk_djs.push(afk_user_id);
        my_queue.splice(1, 0, afk_user_id);
    } else {
        // was already afk, so insert at end if queue length is > 3
        if (my_queue.length > 3) {
            my_queue.push(afk_user_id);
        }
    }
    stop_countdown();
    alert_next_dj();
}

function stop_countdown() {
    clearTimeout(countdown_timeout_id);
    countdown_timeout_id = false;
}

function show_mods() {
    var all_mods = my_room_manager["moderators"];
    var present_mods = [];
    for (var a = 0; a < my_room_manager["moderators"].length; a++) {
        var user_id = my_room_manager["moderators"][a];
        if (user_hash[user_id] != undefined) {
            present_mods.push(all_mods[a]);
        }
    }

    if (present_mods.length == 0) {
        var input_message = "No mods!";
    } else {
        var input_message = "Mods: ";
        for (var a = 0; a < present_mods.length; a++) {
            var user_id = present_mods[a];
            input_message += get_username(user_id, true);
            if (a != present_mods.length - 1) {
                input_message += ", ";
            }
        }
    }
    deliver_chat(input_message);
}

function is_mod(user_id) {
    return (my_room_manager["moderators"].indexOf(user_id) > -1);
}

function show_help() {
    deliver_chat("+++++++++++ Commands +++++++++++");
    var commands_list = "";
    for (var command in available_commands) {
        if (available_commands[command][2]) commands_list += command + " | ";
    }
    setTimeout("deliver_chat(\"" + commands_list.substring(0, commands_list.length - 3) + "\")", 500);
    setTimeout("deliver_chat(\"Type /help [command] for more info on a command (ie. /help q)\");", 1000);
}

function show_mod_help() {
    deliver_chat("+++++++++ Mod Commands +++++++++");
    var commands_list = "";
    for (var command in mod_commands) {
        if (mod_commands[command][2]) commands_list += command + " | ";
    }
    setTimeout("deliver_chat(\"" + commands_list.substring(0, commands_list.length - 3) + "\")", 500);
}

function deliver_chat(input_message) {
    // bot text can interrupt your current message. save chat before sending bot message
    my_chat = $('.input-box > input').val();
    // deliver bot chat
    $('.input-box > input').val(input_message);
    $('.input-box').trigger('submit');
    // continue chatting
    $('.input-box > input').val(my_chat);
}

function get_help(options) {
    var text = options["text"];
    var command = text.substring(6, text.length);
    if (available_commands[command]) {
        var input_message = available_commands[command][1];
    } else if (available_commands[command + " "]) {
        var input_message = available_commands[command + " "][1];
    } else {
        var input_message = "";
    }
    deliver_chat(input_message);
}

function join_instructions(user_id) {
    var username = get_username(user_id, true, true);
    if (visited_users.indexOf(user_id) == -1) {
        // for newcomers
        visited_users.push(user_id);
        var input_message = "Hey " + username + ", welcome to Connect The Songs! Type /help for a list of commands or q+ to join the queue.";
        deliver_chat(input_message);
    }
}

function is_dj(username) {
    var dj_index = -1;
    var user_id = get_user_id(username, true);
    for (var index in dj_hash) {
        if (user_id == dj_hash[index]) {
            // user is a dj
            dj_index = index;
            break;
        }
    }
    return dj_index;
}

function boot(user_id) {
    my_room_manager.callback('boot_user', user_id);
    $('.bootReasonField.text').val("We have a queue system in effect. Please stop taking the open seat.");
    $('.ok-button.centered-button').trigger('click');
    $('.modal > .close-x').trigger('click');
}

function check_ban(user_id) {
    if (auto_banned.indexOf(user_id) > -1) {
        // boot
        boot(user_id);
    } else {
        join_instructions(user_id);
    }
}

function promote(options) {
    var user_id = options['user_id'];
    if (user_id in user_hash) {
        var index = my_queue.indexOf(user_id);
        if (index > -1) {
            // user was already in queue, so remove
            my_queue.splice(index, 1);
        }
        my_queue.unshift(user_id);
    }
}

function get_user_id(username, strict) {
    var user_id;
    var current_name = "";
    if (strict == true) {
        for (var index in user_hash) {
            current_name = user_hash[index]["name"];
            if (current_name.toLowerCase() == username.toLowerCase()) {
                // user found, get id
                user_id = index;
                break;
            }
        }
    } else {
        // use temp hash
        for (var index in temp_user_hash) {
            current_name = temp_user_hash[index]["name"];
            if (current_name.toLowerCase() == username.toLowerCase()) {
                // user found, get id
                user_id = index;
                break;
            }
        }
    }
    return user_id;
}

function get_username(user_id, strict, prepend_at) {
    var username = strict ? user_hash[user_id]["name"] : temp_user_hash[user_id]["name"];
    return prepend_at ? (username[0] == "@" ? username : "@" + username) : username;
}

function show_queue(options) {
    if (queue_enabled) {
        var user_id = options['user_id'];
        var queue_length = my_queue.length;
        var input_message = "";
        var username = get_username(user_id, true);
        if (dj_hash.length < 5 && is_dj(username) == -1 && my_queue.length == 0) {
            var input_message = "The queue is empty! Type q+ to join.";
        } else {
            if (queue_length == 0) {
                var input_message = "No one's in the queue."
                if (!is_dj(username)) {
                    input_message += "Add yourself to the queue by typing q+";
                }
            } else {
                var input_message = queue_length + " in queue: ";
                for (var a = 0; a < my_queue.length; a++) {
                    input_message += get_username(my_queue[a], false);
                    if (a != my_queue.length - 1) {
                        input_message += ", ";
                    }
                }
            }
        }
        deliver_chat(input_message);
    } else deliver_chat("Queueing system is currently disabled by the bot owner!");
}

function add_to_queue(options) {
    if (queue_enabled) {
        var user_id = options['user_id'];
        var username = get_username(user_id, true);
        var displayname = get_username(user_id, true, true);
        var input_message = "";
        if (dj_hash.length < 5 && is_dj(username) == -1 && my_queue.length == 0) {
            input_message = "There's an open spot, " + displayname + ", step up! :]";
        } else {
            if (is_dj(username) > -1) {
                input_message = displayname + ", you're already on deck! :]"
            } else {
                if (my_queue.indexOf(user_id) == -1) {
                    my_queue.push(user_id);
                }
                var user_queue_index = my_queue.indexOf(user_id);
                if (user_queue_index == 0) {
                    input_message = displayname + ", you are first in the queue.";
                    verify_play_count();
                } else {
                    input_message = displayname + ", you are #" + (user_queue_index + 1) + " in the queue, right behind " + get_username(my_queue[user_queue_index - 1], false) + ".";
                }
            }
        }
        deliver_chat(input_message);
    } else deliver_chat("Queueing system is currently disabled by the bot owner!");
}

function mod_add_to_queue(options) {
    var username = options['args'];
    var user_id = get_user_id(username);
    if (user_id != null) {
        add_to_queue({
            'user_id': user_id
        });
    } else deliver_chat("User not found!");
}

function mod_remove_from_queue(options) {
    var user_id = options['user_id'];
    var index = options['args'];
    if (!isNaN(index) && index <= my_queue.length && index > 0) {
        console.log(get_username(user_id, true) + ' can remove user at index ' + index);
        var removed_user_id = my_queue[index - 1];
        my_queue.splice(index - 1, 1);
        deliver_chat("Removed " + get_username(removed_user_id, false, true) + " from the queue.");
    } else if (get_user_id(index)) {
        var removed_user_id = get_user_id(index);
        if (my_queue.indexOf(removed_user_id) > -1) {
            my_queue.splice(my_queue.indexOf(removed_user_id), 1);
            deliver_chat("Removed " + get_username(removed_user_id, false, true) + " from the queue.");
        } else deliver_chat(get_username(removed_user_id, false, true) + " is not in the queue.");
    } else deliver_chat("User not found!");
}

function remove_from_queue(options) {
    var user_id = options["user_id"];
    var type = options["type"];
    if (type == undefined || type == "manual") {
        var username = get_username(user_id, true, true);
        var index = my_queue.indexOf(user_id);
        if (index != -1) {
            if (index == 0 && countdown_timeout_id != false) {
                my_queue.splice(index, 1);
                stop_countdown();
                alert_next_dj();
            } else {
                my_queue.splice(index, 1);
            }
            var input_message = "Removed " + username + " from the queue. ";
            if (my_queue.length == 0) {
                input_message += "No one left in the queue!";
            } else {
                input_message += "Next up: " + get_username(my_queue[0], false);
            }
            deliver_chat(input_message);
        } else deliver_chat(username + ", you're not in the queue!");
    } else if (type == "deregister") {
        var index = my_queue.indexOf(user_id);
        var username = get_username(user_id, false, true);

        if (index != -1) {
            my_queue.splice(index, 1);
        }
        var input_message = "Removed " + username + " from the queue for leaving the room for over 15 minutes.";
        deliver_chat(input_message);
    }
}

function shift_in_queue(options) {
    var user_id = options["user_id"];
    var username = get_username(user_id, true);
    var index = my_queue.indexOf(user_id);
    if (index > -1 && index < my_queue.length - 1) {
        my_queue.splice(index, 1);
        my_queue.splice(index + 1, 0, user_id);
        show_queue(options);
    }
}

function remove_from_afk(user_id) {
    var index = afk_djs.indexOf(user_id);
    if (index > -1) {
        afk_djs.splice(index, 1);
    }
}

function remove_dj(user_id, steal) {
    if (manage_strict) {
        if (steal) {
            if (dj_steal_hash[user_id] == undefined || dj_steal_hash == 3) {
                dj_steal_hash[user_id] = 1;
            } else {
                dj_steal_hash[user_id] += 1;
            }
            if (dj_steal_hash[user_id] == 3) {
                // boot
                boot(user_id);
            } else {
                my_room_manager.callback('remove_dj', user_id);
            }
        } else {
            my_room_manager.callback('remove_dj', user_id);
        }
    }
}

function alert_next_dj() {
    if (queue_enabled) {
        // prereqs: < 5 djs and > 0 people on queue and no one is being called
        if (dj_hash.length < 5 && countdown_timeout_id == false) {
            // only alert people if someone hasn't been alerted
            if (my_queue.length > 0) {
                // there are people in the queue to alert
                while (!(my_queue[0] in user_hash)) {
                    my_queue.splice(0, 1);
                }
                var username = get_username(my_queue[0], false, true);
                var input_message = username + ", it's your turn to DJ. You have 20 seconds to step up.";
                stop_countdown();
                countdown_timeout_id = setInterval("countdown()", 20000);
            } else {
                // no one is in the queue
                var input_message = "Open seat! FFA until someone joins queue!";
            }
            deliver_chat(input_message);
        }
    }
}

function personalized_dj_msg(user_id) {
    var username = get_username(user_id, true);
    var message = "";
    return message;
}

function catch_add_dj(user_id) {
    var username = get_username(user_id, true, true);
    if (my_queue.length == 0) {
        var input_message = personalized_dj_msg(user_id);
        // reset their steal count
        dj_steal_hash[user_id] = 0;
        refresh_dj_hash();
    } else {
        if (my_queue.indexOf(user_id) == 0) {
            // start message
            var input_message = personalized_dj_msg(user_id);
            // remove them from queue
            var index = my_queue.indexOf(user_id);
            my_queue.splice(index, 1);
            // reset their steal count
            dj_steal_hash[user_id] = 0;
            // clear countdown
            stop_countdown();
            // remove them from afk
            remove_from_afk(user_id);
            // alert the next dj
            alert_next_dj();
        } else {
            var input_message = username + ", we have a queue system in effect. Please type q+ to join.";
            remove_dj(user_id, true);
        }
    }
    dj_play_count[user_id] = 0;
    deliver_chat(input_message);
}

function catch_rem_dj(user_id) {
    if (dj_steal_hash[user_id] == 3) {
        // this guy was removed because he was trying to steal an open spot. don't do anything
        dj_steal_hash[user_id] = 0;
    } else {
        // this guy left the decks, and is no longer a dj
        var username = get_username(user_id, true, true);
        var input_message = "";
        // detect if it was an accident
        if (reserve(user_id) == true) {
            input_message += username + "'s seat is reserved for 1 minute.";
        } else {
            // otherwise
            delete dj_play_count[user_id];
            // there's an open spot, so call alert next dj
            refresh_dj_hash();
            alert_next_dj();
        }
        deliver_chat(input_message);
    }
}

function reserve(user_id) {
    return false;
    // if (dj_play_hash[user_id] != undefined && dj_play_hash[user_id]["count"] < 2){
    // return true;
    // }
    // else{
    // return false;
    // }
}

function deregister_user(user_id) {
    // if user is not in queue, just remove him from user_hash
    if (my_queue.indexOf(user_id) == -1) {
        delete temp_user_hash[user_id];
    } else {
        // hes on queue, so set temp user hash new time
        temp_user_hash[user_id]["leave_time"] = new Date();
    }
    refresh_user_hash();
    refresh_dj_hash();
}

function temp_user_hash_leave_timer() {
    // loops through temp user hash to find users who left
    var current_time = new Date();
    for (var user_id in temp_user_hash) {
        var leave_time = temp_user_hash[user_id]["leave_time"];
        if (leave_time != 0) {
            if (current_time - leave_time > 900000) {
                // remove this user from queue and temp hash
                remove_from_queue({
                    "user_id": user_id,
                    "type": "deregister"
                });
                delete temp_user_hash[user_id];
                stop_countdown();
                alert_next_dj();
            }
        }
    }
}

function show_plays(options) {
    var user_id = options['user_id'];
    var input_message = "";
    if (dj_hash.length > 0) {
        for (var a = 0; a < 5; a++) {
            if (dj_hash[a] != undefined) {
                input_message += dj_play_count[dj_hash[a]];
            } else {
                input_message += "_";
            }
            if (a != 5 - 1) {
                input_message += " . ";
            }
        }
    } else {
        input_message = "No one's playing right now, so you should DJ for us, " + get_username(user_id, true, true) + "!";
    }
    deliver_chat(input_message);
}

function set_owner(options) {
    var user_id = options['user_id'];
    if (bot_owner[0] == "[unassigned]") {
        bot_owner[0] = get_username(user_id, true);
        bot_owner[1] = user_id;
        deliver_chat("Bot owner set to " + bot_owner[0] + ".");
    } else deliver_chat("Bot already claimed by " + bot_owner[0] + ".");
}

function show_owner(options) {
    deliver_chat("Bot owner: " + bot_owner[0] + ".");
}

function enable_queue(options) {
    if (!queue_enabled) {
        queue_enabled = true;
        deliver_chat("Queueing system successfully enabled.");
    } else deliver_chat("Queue already enabled.");
}

function disable_queue(options) {
    if (queue_enabled) {
        queue_enabled = false;
        deliver_chat("Queueing system successfully disabled.");
    } else deliver_chat("Queue already disabled.");
}

function vote_up(options) {
    my_room_manager.callback('upvote');
	var input_message = "Party time!";
	deliver_chat(input_message);
}

function enable_strict(options) {
    if (!manage_strict) {
        manage_strict = true;
        deliver_chat("Strict mode successfully enabled.");
    } else deliver_chat("Strict mode already enabled.");
}

function disable_strict(options) {
    if (manage_strict) {
        manage_strict = false;
        deliver_chat("Strict mode successfully disabled.");
    } else deliver_chat("Strict mode already disabled.");
}

var available_commands = {
    // Format as follows:
    // command: [function, description, show_in_help]
    'q': [show_queue, "q : Shows waitlist.", true],
    'q+': [add_to_queue, "q+ : Adds yourself to waitlist.", true],
    'q-': [remove_from_queue, "q- : Removes yourself from waitlist.", true],
    '/plays': [show_plays, "/plays : Shows DJ play count on deck.", true],
    '/bop': [vote_up, "/bop : Votes \"Awesome\" on the current song.", true],
    '/dance': [vote_up, "/dance : Votes \"Awesome\" on the current song.", true],
    '/owner': [show_owner, "/owner : Shows bot owner.", true],
    '/modhelp': [show_mod_help, "/modhelp : Shows mod-only commands.", true],
    '/help': [show_help, '', false],
    '/help ': [get_help, '', false],
    '/rickroll ': [rickroll, '', false],
};

var mod_commands = {
    '/add ': [mod_add_to_queue, "/add [name] : Adds [name] to the queue.", true],
    '/remove ': [mod_remove_from_queue, "/remove [name or #] : Removes [name] or user in queue index [#].", true],
    '/mods': [show_mods, "/mods : Lists available mods.", true],
    '/claimbot': [set_owner, '/claimbot : Sets yourself as the bot owner.', true],
    '/enablestrict': [enable_strict, '/enablestrict : Enables strict queue management (auto-remove DJs and stealers).', true],
    '/disablestrict': [disable_strict, '/disablestrict : Disables strict queue management.', true],
    '/enable': [enable_queue, '/enable : Enables queue.', true],
    '/disable': [disable_queue, '/disable : Disables queue.', true]
};

turntable.addEventListener("message", function (m) {
    var command = m["command"];
    if (command == "speak") {
        var user_id = m["userid"];
        var text = m["text"].toLowerCase();
        var options = {
            'user_id': user_id,
            'text': text,
            'args': text.indexOf(" ") > -1 ? text.substring(text.split(" ")[0].length + 1, text.length) : ""
        };
        if (available_commands[text]) {
            available_commands[text][0](options);
        } else if (available_commands[text.split(" ")[0] + " "]) {
            available_commands[text.split(" ")[0] + " "][0](options);
        } else if (mod_commands[text]) {
            if (is_mod(user_id)) {
                mod_commands[text][0](options);
            } else deliver_chat("Sorry, only mods can do that.");
        } else if (mod_commands[text.split(" ")[0] + " "]) {
            if (is_mod(user_id)) {
                mod_commands[text.split(" ")[0] + " "][0](options);
            } else deliver_chat("Sorry, only mods can do that.");
        }
        set_active_users(user_id);
        } else if (command == "add_dj") {
            var user_id = m["user"][0]["userid"];
            catch_add_dj(user_id);
        } else if (command == "rem_dj") {
            var user_id = m["user"][0]["userid"];
            catch_rem_dj(user_id);
        } else if (command == "registered") {
            var user_id = m["user"][0]["userid"];
            check_ban(user_id);
            refresh_user_hash();
            update_temp_user_hash(user_id, "add");
        } else if (command == "deregistered") {
            var user_id = m["user"][0]["userid"];
            deregister_user(user_id);
        } else if (command == "new_moderator") {
            show_mods();
        } else if (command == "rem_moderator") {
            show_mods();
        } else if (command == "newsong") {
            current_song = m['room']['metadata']['current_song'];
            var previous_dj = dj_hash[dj_hash.indexOf(my_room_manager['current_dj'][0]) - 1 % dj_hash.length];
            var previous_dj_plays = dj_play_count[previous_dj];
            if (previous_dj_plays >= 2 && my_queue.length > 0) {
                deliver_chat(get_username(previous_dj, false, true) + ", you've played " + previous_dj_plays + " songs. " + (manage_strict ? "Removing you" : "Would you mind stepping down") + " to allow the next person in the queue to DJ" + (manage_strict ? "." : "?"));
			remove_dj(previous_dj, false);
        }
        dj_play_count[my_room_manager["current_dj"][0]]++;
        console.log('new song');
    }
});

function verify_play_count() {
    var highest_play_count = ["", 0];
    for (var num in dj_hash) {
        var dj = dj_hash[num];
        if (dj != my_room_manager['current_dj'][0] && dj_play_count[dj] >= 2 && dj_play_count[dj] > highest_play_count[1]) {
            highest_play_count = [dj, dj_play_count[dj]];
        }
    }
    if (highest_play_count[0] != "") {
        deliver_chat(get_username(highest_play_count[0], false, true) + ", you've played " + highest_play_count[1] + " songs. Would you mind stepping down to allow the next person in the queue to DJ?");
    }
}

function set_active_users(user_id) {
    // m is message event listener
    if (user_id in temp_user_hash) {
        temp_user_hash[user_id]["last_active"] = new Date();
    }
}

function get_active_users() {
    var active_users = [];
    var current_time = new Date();
    for (user_id in temp_user_hash) {
        if (current_time - temp_user_hash[user_id]["last_active"] <= 180000) {
            active_users.push(user_id);
        }
    }
    return active_users;
}

function get_kick_threshold() {
    var active_users_count = get_active_users().length;
    if (active_users_count <= 5) {
        return 3;
    } else {
        return parseInt(0.5 * active_users_count);
    }
}

function rickroll(options) {
    var user_id = options["user_id"];
    var text = options["text"];
    var rickrolled_username = text.substring(10, text.length);
    if (rickrolled_username.length == 0) {
        var messages = ["never gonna give you up", "never gonna let you down", "never gonna run around and desert you", "never gonna make you cry", "never gonna say goodbye", "never gonna tell a lie and hurt you"];
    } else {
        var messages = ["never gonna give " + rickrolled_username + " up", "never gonna let " + rickrolled_username + " down", "never gonna run around and desert " + rickrolled_username, "never gonna make " + rickrolled_username + " cry", "never gonna say goodbye", "never gonna tell a lie and hurt " + rickrolled_username];
    }
    var input_message = get_username(user_id, true) + "'s " + messages[rickroll_index % 6];
    rickroll_index++;
    deliver_chat(input_message);
}

for (var i in dj_hash) {
    dj_play_count[dj_hash[i]] = 0;
}
dj_play_count[my_room_manager['current_dj'][0]] = 1;

// log messages
var handleMessage = function (m) {
        console.log(m);
    }
turntable.addEventListener("message", handleMessage);

var soundstartMessage = function (m) {
        console.log(m);
    }
turntable.addEventListener("trackstart", soundstartMessage);

// intervals
setInterval("temp_user_hash_leave_timer()", 10000);

deliver_chat("CTS bot successfully initialized.");