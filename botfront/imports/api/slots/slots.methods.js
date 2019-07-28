import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';

import { Slots } from './slots.collection';
import { checkIfCan } from '../../lib/scopes';
import { slotSchemas } from './slots.schema';

function validateSchema(slot) {
    if (slot.type) {
        slotSchemas[slot.type].validate(slot, { check });
    } else {
        throw new Meteor.Error('400');
    }
}

function handleError(e) {
    if (e.code === 11000) {
        throw new Meteor.Error(400, 'Slot already exists');
    }
    throw new Meteor.Error(500, 'Server Error');
}

Meteor.methods({
    'slots.insert'(slot, projectId) {
        check(slot, Object);
        check(projectId, String);
        checkIfCan('stories:w', projectId);
        validateSchema(slot);
        try {
            return Slots.insert(slot);
        } catch (e) {
            return handleError(e);
        }
    },

    'slots.update'(slot, projectId) {
        check(slot, Object);
        check(projectId, String);
        checkIfCan('stories:w', projectId);
        validateSchema(slot);
        try {
            return Slots.update({ _id: slot._id }, { $set: slot });
        } catch (e) {
            return handleError(e);
        }
    },

    'slots.delete'(slot, projectId) {
        check(slot, Object);
        check(projectId, String);
        checkIfCan('stories:w', projectId);
        validateSchema(slot);
        return Slots.remove(slot);
    },

    'slots.getSlots'(projectId) {
        check(projectId, String);
        return Slots.find({ projectId }).fetch();
    },
});
