import {GQLClientMutation} from "./client";
import Query from "./query";

/**
 Handles `mutation` request send to the server.
**/
export default class GQLMutation extends Query {
	__send(headers, query, variables) {
		return GQLClientMutation({
			headers,
			query: {query: `mutation ${query}`, variables}
		})
		.catch(this.__handleErrorResponse)
		.then(this.__handleResponse);
	}
}

/**
 Runs and execute a single `mutation` request send to the server.

 @param {object} query
 	The single query to run. It has the same parameters as to setting a query in `Mutation` class.
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
export function gqlMutator(query, vars = {}, headers = false) {
	const mutator = new GQLMutation();
	mutator.set(query);

	const handleResponse = ([errors]) => {
		if (errors && errors.serverError) {
			return query.onError.call(null, errors.serverError);
		}

		if (errors && errors[query.name]) {
			return query.onError.call(null, errors[query.name]);
		}
	}

	return mutator.exec(vars, headers).then(handleResponse);
}