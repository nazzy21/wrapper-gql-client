import {GQLClientQuery} from "./client";
import * as _ from "./utils";
import {i18n} from "./lang";

/**
 Handles graphql `query` to the server.
**/
export default class GQLQuery {
	constructor() {
		// Define containers
		this.reset();

		// Bind listeners
		this.handleErrorResponse = this.handleErrorResponse.bind(this);
		this.handleResponse = this.handleResponse.bind(this);
	}

	/**
	 Helper method to reset the query removing all query entries.
	**/
	reset() {
		this.errors = {};
		this.queries = [];
		this.directives = [];
		this.successCallbacks = {};
		this.errorCallbacks = {};
	}

	/**
	 Check if it contains queries.

	 @returns {Boolean}
	**/
	hasQueries() {
		return this.queries.length > 0;
	}

	/**
	 Get the object query previously set.

	 @param {string} nameOrAlias
	 @returns {object}
	**/
	get(nameOrAlias) {
		const pos = _.findIndex(this.queries, {name: nameOrAlias});

		if (!pos) {
			return null;
		}

		return this.queries[pos];
	}

	/**
	 @param {string} nameOrAlias
	 	A unique name to quickly identify the query. The name must also similar to the `query` argument.
	 @param {object} args
	 	An object which defines the types of argument the query contain.
	 	{
			@property {string} type
				The GraphQL type of argument i.e. `String`, `Boolean`
			@property {string|function} value
				The default value to use if there's no argument found in the object variables that sends
				with the query.
				If the supplied value is of type function, the function is called just before the query
				is send.
	 	}
	 @param {string} query
	 	An AST style query string to send to the server. If a query contains an arguments, the arguments
	 	must be present in the `args` parameter and it's value must be prefix with dollar sign.
	 	Example:
	 		`getUser(Id: $Id)`

	 		where the $Id is set in the `args` param as:
	 		`args => {
				Id: {type: "Int"}
	 		}`
	 @param {function} onSuccess
	 	The callable function to execute on successful query.
	 @param {function} onError
	 	The callable function to execute if the query consist of errors.
	 @returns {void}
	**/
	set({nameOrAlias, args = {}, query, onSuccess, onError}) {
		_.devAssert(!_.isEmpty(nameOrAlias), "Missing query name!");
		_.devAssert(!_.isEmpty(query), "Missing query definition!");

		if (onSuccess) {
			this.successCallbacks[nameOrAlias] = onSuccess;
		}

		if (onError) {
			this.errorCallbacks[nameOrAlias] = onError;
		}

		// Check if query exist
		let pos = _.findIndex(this.queries, {name: nameOrAlias});

		if (pos < 0) {
			pos = this.queries.length;
		}

		this.queries[pos] = {name: nameOrAlias, query, args};
	}

	/**
	 Removes a query from the list of exectables.

	 @param {string} nameOrAlias
	 	The name or alias set in the query.
	 @returns {void}
	**/
	unset(nameOrAlias) {
		const pos = _.findIndex(this.queries, {name: nameOrAlias});

		if (!pos) {
			return;
		}

		delete this.queries[pos];
	}

	/**
	 Sends the queries to a graphql server.

	 @param {object} variables
	 	An object containing the corresponding values in the the queries arguments.
	 @param {object} headers
	 	An additional headers to set for the query.
	 @returns {Promise<[Errors, Object]>}
	**/
	exec(variables = {}, headers = null) {
		let queries = [],
			queryArgs = {},
			vars = {};

		this.queries.map( query => this.__getQuery(query, queries, queryArgs, vars, variables) );

		if (!queries.length) {
			return Promise.resolve(true);
		}

		queries = queries.join(" ");

		// Wrap query variables
		if (!_.isEmpty(queryArgs)) {
			const def = [];

			for(const key of _.keys(queryArgs)) {
				def.push(`$${key}: ${queryArgs[key]}`);
			}

			queries = `WRAPPER(${def.join(" ")}) { ${queries} }`;
		} else {
			vars = null;
			queries = `{${queries}}`;
		}

		if (!_.isEmpty(this.directives)) {
			queries = this.directives.join(" ") + queries;
		}

		return this.__send(headers, queries, vars);
	}

	/**
	 @private
	**/
	__send(headers, query, variables) {
		this.errors = {};

		return GQLClientQuery({
			headers,
			query: {query: `query ${query}`, variables}
		})
		.catch(this.__handleErrorResponse)
		.then(this.__handleResponse);
	}

	/**
	 @private
	 @callback
	**/
	__handleErrorResponse(err) {
		return this.serverError([err]);
	}

	/**
	 @private
	 @callback
	**/
	__serverError(errors) {
		const err = errors.pop();

		this.errors.serverError = {message: err.message, code: "serverError"};

		return [this.errors];
	}

	/**
	 @private
	 @callback
	**/
	__handleResponse(res) {
		if (!res) {
			return this.__serverError([{
				message: "Something went wrong. Unable to process request!",
				code: "serverError"
			}]);
		}

		// Handle server error
		if (_.isArray(res)) {
			return this.__serverError(res);
		}

		let {data = {}, error = {}, errors} = res.data;

		if (errors) {
			return this.__serverError(errors);
		}

		// Call errors first
		this.__execErrors(error);

		// Run success callbacks
		this.__execSuccess(data);

		return [this.errors, data];
	}

	/**
	 @private
	**/
	__execErrors(errors) {
		for(const key of _.keys(errors)) {
			if (!this.errorCallbacks[key]) {
				continue;
			}

			this.errorCallbacks[key].call(null, errors[key], this);
		}
	}

	/**
	 @private
	**/
	__execSuccess(data) {
		for(const key of _.keys(data)) {
			if (!this.successCallbacks[key]) {
				continue;
			}

			this.successCallbacks[key].call(null, data[key], this);
		}
	}

	/**
	 Helper function to iterate the list of queries.

	 @private

	 @param {object} query
	 	The query to iterate to.
	 @param {array} queries
	 	The container which contains the list of iterated queries.
	 @param {object} queryArgs
	 	The container which holds the arguments of each query.
	 @param {object} vars
	 	The container which holds the used variables in the query.
	 @param {object} variables
	 	The list of variables supplied in the query.
	**/
	__getQuery(query, queries, queryArgs, vars, variables) {
		if (!args || _.isEmpty(args)) {
			queries.push(query);

			return;
		}

		for(const key of Object.keys(args)) {
			const {type, value} = args[key],
				argKey = `${name}_${key}`;

			if (value && _.isFunction(value)) {
				value = value.call(null);
			}

			let _value = variables[key] || value;

			if (type.match(/Int/)) {
				_value = parseInt(_value);
			}

			vars[argKey] = _value;
			queryArgs[argKey] = type;
			query = query.replace(`$${key}`, `$${argKey}`);
		}

		queries.push(query);
	}
}

/**
 Runs and executes a single query.

 @param {object} query
 	The single query to run. It has the same parameters as to setting a query in `Query` class.
 	{
		@property {string} nameOrAlias
		@property {object} args
		@property {string} query
		@property {function} onSuccess
		@property {funciton} onError
 	}
 @param {object} vars
 	The variables to supply the value of the query's arguments.
 @param {object} headers
 	A custom headers to set in the query.
 @returns {Promise<[Errors, Data]>}
**/
export function gqlQuery(query, vars = {}, headers = false) {
	const gql = new GQLQuery();
	gql.set(query);

	const handleResponse = ([errors, data]) => {
		if (errors && errors.serverError) {
			return query.onError.call(null, errors.serverError);
		}

		if (errors && errors[query.name]) {
			return query.onError.call(null, errors[query.name]);
		}

		return [errors, data];
	}

	return gql.exec(vars, headers).then(handleResponse);
}