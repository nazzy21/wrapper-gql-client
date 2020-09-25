import * as _ from "underscore";

_.extend(_, {devAssert});

export default _;

function devAssert(condition, message) {
    if ((_.isBoolean(condition) && condition) || condition) {
        return;
    }

    throw new Error(message);
}
