import { find, intersectionBy, sortBy } from 'lodash';
import { safeDump } from 'js-yaml';
import { check, Match } from 'meteor/check';
import { Projects } from './project.collection';
import { formatError } from '../../lib/utils';
import { checkIfCan } from '../../lib/scopes';
import { formatNewlines } from './response.utils';

export const getTemplateLanguages = (templates) => {
    const langs = [];
    templates.forEach(t => t.values.forEach((v) => {
        if (langs.indexOf(v.lang) < 0) langs.push(v.lang);
    }));
    return sortBy(langs);
};

Meteor.methods({
    'project.updateTemplate'(projectId, key, item) {
        check(projectId, String);
        checkIfCan('responses:w', projectId);
        check(key, String);
        check(item, Object);

        // item.values[0].sequence needs to be changed to work with the new items
        const formattedItem = item;
        formattedItem.values[0].sequence = formatNewlines(item.values[0].sequence);

        try {
            return Projects.update(
                { _id: projectId, 'templates.key': key },
                { $set: { 'templates.$': formattedItem, responsesUpdatedAt: Date.now() } },
            );
        } catch (e) {
            throw new Meteor.Error(e);
        }
    },

    'project.deleteTemplate'(projectId, key, lang = 'en') {
        check(projectId, String);
        checkIfCan('responses:w', projectId);
        check(lang, String);
        check(key, String);
        
        try {
            return Projects.update(
                { _id: projectId, 'templates.key': key },
                { $pull: { templates: { key } }, $set: { responsesUpdatedAt: Date.now() } },
            );
        } catch (e) {
            throw new Meteor.Error(e);
        }
    },
});

if (Meteor.isServer) {
    Meteor.methods({
        'project.findTemplate'(projectId, key, lang = 'en') {
            check(projectId, String);
            checkIfCan('responses:r', projectId);
            check(key, String);
            check(lang, String);

            try {
                let template = Projects.findOne(
                    {
                        _id: projectId,
                        templates: { $elemMatch: { key } },
                    },
                    {
                        fields: {
                            templates: { $elemMatch: { key } },
                        },
                    },
                );
                const newSeq = {
                    sequence: [{ content: safeDump({ text: key }) }],
                    lang,
                };
                if (!template) {
                    template = { key, values: [newSeq] };
                    Projects.update(
                        { _id: projectId },
                        {
                            $push: { templates: template },
                            $set: { responsesUpdatedAt: Date.now() },
                        },
                    );
                    return template;
                }
                if (!template.templates[0].values.some(v => v.lang === lang)) {
                    template.templates[0].values.push(newSeq);
                    Projects.update(
                        { _id: projectId, 'templates.key': key },
                        {
                            $push: { 'templates.$.values': newSeq },
                            $set: { responsesUpdatedAt: Date.now() },
                        },
                    );
                }
                return template.templates[0];
            } catch (e) {
                throw new Meteor.Error(e);
            }
        },

        'project.insertTemplate'(projectId, item) {
            check(projectId, String);
            checkIfCan('responses:w', projectId);
            check(item, Object);

            const { key } = item;
            const { templates } = Projects.findOne({ _id: projectId }, { fields: { templates: 1 } });

            if (find(templates, { key })) {
                throw new Meteor.Error('template-collision', `Can not add template because one already exists with the key ${key}`);
            }

            try {
                Projects.update(
                    { _id: projectId },
                    { $push: { templates: item }, $set: { responsesUpdatedAt: Date.now() } },
                );
            } catch (e) {
                throw new Meteor.Error(e);
            }
        },

        'templates.download'(projectId) {
            check(projectId, String);
            checkIfCan('responses:r', projectId);

            const project = Projects.findOne({ _id: projectId }, { fields: { templates: 1 } });
            if (!project) throw new Meteor.Error('404', 'Project not found');
            return project.templates;
        },

        'templates.import'(projectId, templates) {
            check(projectId, String);
            checkIfCan('responses:w', projectId);
            check(templates, Match.OneOf(String, [Object]));

            const newTemplates = (typeof templates === 'string') ? JSON.parse(templates) : templates;
            const { templates: oldTemplates } = Projects.findOne({ _id: projectId }, { fields: { templates: 1 } });
            const pullTemplatesKey = intersectionBy(oldTemplates, newTemplates, 'key').map(({ key }) => key);

            try {
                Projects.update({ _id: projectId }, { $pull: { templates: { key: { $in: pullTemplatesKey } } } });
                Projects.update(
                    { _id: projectId },
                    { $push: { templates: { $each: newTemplates } }, $set: { responsesUpdatedAt: Date.now() } },
                );
            } catch (e) {
                throw new Meteor.Error(e);
            }
        },

        'templates.removeByKey'(projectId, arg) {
            check(projectId, String);
            checkIfCan('responses:w', projectId);
            check(arg, Match.OneOf(String, [String]));

            const templateKeys = (typeof arg === 'string') ? [arg] : arg;

            try {
                Projects.update(
                    { _id: projectId },
                    { $pull: { templates: { key: { $in: templateKeys } } }, $set: { responsesUpdatedAt: Date.now() } },
                );
            } catch (e) {
                throw formatError(e);
            }
        },

        'templates.countWithIntent'(projectId, intent) {
            check(projectId, String);
            checkIfCan(['nlu-data:r', 'responses:r', 'conversations:r'], projectId);
            check(intent, String);
            
            const project = Projects.find(
                { _id: projectId },
                {
                    fields: {
                        templates: {
                            $elemMatch: {
                                'match.nlu.intent': intent,
                            },
                        },
                    },
                },
            ).fetch();

            return !!project[0].templates;
        },
    });
}
