import {gqlQuery} from "./query";
import _ from "./utils";

export default class GQLQueryState {
	/**
	 Constructor

	 @param {string} name
	 	The name or alias of the query to run when fetching the state data from the database.
	 @param {object} args
	 	The query arguments definition.
	 @param {string} query
	 	The GraphQL AST query definition.
	 @param {object} defaults
	 	The default object state.
     @param {array<function>} subscribers
        The list of listeners that listens to the state change.
	**/
	constructor({name, args = {}, query, defaults = {}, subscribers = []}) {
		this.name = name;
		this.args = args;
		this.queryString = query;
		this.state = this.prepareState(defaults||{});
		this.oldState = {};
        this.state = defaults || {};
        this.subscribers = subscribers || [];

        // Bind methods for convenience
        this.set = this.set.bind(this);
        this.setSync = this.setSync.bind(this);
        this.reset = this.reset.bind(this);
        this.resetSync = this.resetSync.bind(this);
        this.unset = this.unset.bind(this);
        this.unsetSync = this.unsetSync.bind(this);
        this.__onSuccess = this.__onSuccess.bind(this);
        this.__onError = this.__onError.bind(this);
        this.toQuery = this.toQuery.bind(this);
	}

    /**
     Helper method to prepare the state before setting.
    **/
    prepareState(state) {
        return state;
    }

	/**
	 Sets or replace a new value of the query arguments.

	 @param {object} args
	 	An object where the property name is the argument name of the query arguments while it's value
	 	is anything that corresponds to the argument key.
	 	If an argument key was not previously set, it's value must be in object format defining the type
	 	of data the argument value may contain.
	 @returns {void}
	**/
	setArgs(args = {}) {
		for(const key of _.keys(args)) {
			if (!this.args[key]) {
				this.args[key] = args[key];

				continue;
			}

			this.args[key].value = args[key];
		}
	}

	/**
	 Returns the actual value of the given query argument name.

	 @param {string} name
	**/
	getArg(name) {
		if (!this.args[name]) {
			return null;
		}

		return this.state[name]||this.args[name].value||null;
	}

	/**
	 Returns an object which composes the GraphQL query.
	**/
	toQuery() {
		const args = {};

		for(const key of _.keys(this.args)) {
			args[key] = this.args[key];
            args[key].value = this.getArg(key);
		}

		return {
			name: this.name,
			args: args,
			query: this.queryString,
			onSuccess: this.__onSuccess,
			onError: this.__onError
		};
	}

	/**
	 Sends the query request to the server.

	 @param {function} onSuccess
	 	Optional. A callable function to execute on a successful query.
	 @param {function} onError
	 	Optional. A callable function to execute when the query encounters an error.
	 @returns {Promise<[Error, Data]>}
	**/
	query(onSuccess = false, onError = false) {
		this.successCallback = onSuccess;
		this.errorCallback = onError;

		return gqlQuery(this.toQuery());
	}

	/**
	 @private
	 @callback
	**/
	__onSuccess(res) {
		this.resetSync(res);

		if (this.successCallback) {
			this.successCallback.call(null, this.state, this);
		}

		this.successCallback = false;
		this.errorCallback = false;
	}

	/**
	 @private
	 @callback
	**/
	__onError(err) {
		if (this.errorCallback) {
			this.errorCallback.call(null, err, this);
		}

		this.errorCallback = false;
		this.successCallback = false;
	}

	/**
	 Get the value of the given key name.

	 @param {string} name
	 	The state's key name to get the value from. If omitted, will return the entire state object.
	 @returns {*}
	**/
	get(name = null) {
        if (!name) {
            // Return the entire state
            return _.clone(this.state);
        }

        return this.state[name];
    }

    /**
     Sets a new state property/value.

     @param {string|object} name
     	The state's key name or an object which either set or replace a state.
     @param {*} value
     @returns {void}
    **/
    set(name, value = null) {
        this.oldState = _.extend({}, this.state);

        if (_.isObject(name)) {
            _.extend(this.state, name);

            return;
        }

        this.state[name] = value;
    }

    /**
     Similar to `set` method but calls and executes the hooked listeners.

     @param {string|object} name
     	The state's key name or an object which either set or replace a state.
     @param {*} value
     @returns {void}
    **/
    setSync(name, value = null) {
        this.set(name, value);

        this.__callSubscribers(this.oldState);
    }

    /**
     Removes a single state property from the state object.

     @param {string} name
     	The state's property name.
     @returns {void}
    **/
    unset(name) {
        if (!this.state[name]) {
            return;
        }

        this.oldState = _.extend({}, this.state);

        this.state = _.omit(this.state, name);
    }

    /**
     Similar to `unset` but calls and executes the hooked listeners.

     @param {string} name
     	The state's property name.
     @returns {void}
    **/
    unsetSync(name) {
        if (!this.unset(name)) {
            return;
        }

        this.__callSubscribers(this.oldState);
    }

    /**
     Replaces the entire state object to a new one.

     @param {object} state
     	The new state object to set.
     @returns {void}
    **/
    reset(state) {
        this.oldState = _.extend({}, this.state);
        this.state = this.prepareState(state);
    }

    /**
     Similar to `reset` but calls and executes the hooked listeners.

     @param {object} state
     	The object to replace the state to.
     @returns {void}
    **/
    resetSync(state) {
        this.reset(state);
        this.__callSubscribers(this.oldState);
    }

    /**
     Adds a listener to the state object.

     @param {function} callback
     	The callable function to execute when the state is change.
     @returns {Boolean}
     	Returns true if the listener successfully hooked.
    **/
    subscribe(callback) {
        if( !callback || 'function' !== typeof callback || !callback.name) {
            return false;
        }

        const exist = this.subscribers.filter( cb => cb.name === callback.name );

        if (!_.isEmpty(exist)) {
            return;
        }

        this.subscribers.push(callback);

        return true;
    }

    /**
     Removes a callback listener from the list of hooks.

     @param {function} callback
     	The function that was used to listen to the state.
     @returns {Boolean}
    **/
    unsubscribe(callback) {
        if( !callback || 'function' !== typeof callback || !callback.name) {
            return false;
        }

        this.subscribers = this.subscribers.filter( cb => cb.name !== callback.name );

        return true;
    }

    /**
     * Calls and execute all listeners.
     *
     * @param {object} oldState
     * @private
     */
    __callSubscribers(oldState = false) {
        if (!this.subscribers.length) {
            return;
        }

        let state = _.extend({}, this.state);

        this.subscribers.map( cb => cb.call(null, state, oldState, this));
    }
}