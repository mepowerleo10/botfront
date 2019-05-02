import SimpleSchema from 'simpl-schema';
import { Projects } from '../project/project.collection';

export const UserRoleSchema = new SimpleSchema({
    roles: Array,
    'roles.$': {
        type: String,
        allowedValues: () => Meteor.roles.find({}, { fields: { _id: 1 } })
            .fetch()
            .map(r => r._id)
            .filter(name => !name.match(/\w+:\w+/)),
    },
    project: {
        type: String,
        allowedValues: () => Projects.find({}, { fields: { _id: 1, name: 1 } })
            .fetch()
            .map(p => p._id)
            .concat(['GLOBAL']),
    },
}, { tracker: Tracker });

export const UserEditSchema = new SimpleSchema({
    _id: { type: String },
    emails: Array,
    'emails.$': Object,
    'emails.$.address': { type: String, regEx: SimpleSchema.RegEx.Email },
    'emails.$.verified': { type: Boolean, autoValue: true },
    profile: Object,
    'profile.firstName': { type: String },
    'profile.lastName': { type: String },
    roles: { type: Array, minCount: 1 },
    'roles.$': UserRoleSchema,
}, { tracker: Tracker });

export const UserCreateSchema = new SimpleSchema({
    profile: Object,
    'profile.firstName': { type: String },
    'profile.lastName': { type: String },
    email: { type: String, regEx: SimpleSchema.RegEx.Email },
    sendEmail: { type: Boolean, defaultValue: true },
    roles: { type: Array, minCount: 1 },
    'roles.$': UserRoleSchema,
}, { tracker: Tracker });
