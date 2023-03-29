import { LightningElement, wire, track } from 'lwc';
import { getRecord, createRecord } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import UserName from '@salesforce/schema/User.Name';
import userAlias from '@salesforce/schema/User.Alias';
import userId from '@salesforce/user/Id';
import askMeBuddyCS from '@salesforce/schema/AskMeBuddy__c';
import apiKeyField from '@salesforce/schema/AskMeBuddy__c.Api_key__c';
import getKey from '@salesforce/apex/AskMeBuddy.getKey';
export default class AskMeBuddy extends LightningElement {
    userInputDisabled = false;
    librariesLoaded = false;
    chatEndPoint = 'https://api.openai.com/v1/chat/completions';
    apiKey;
    model = 'gpt-3.5-turbo';
    role = 'user';
    headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` };
    currentUserName = '';
    currentUserAlias = '';
    @track chatData = [];
    isLoading = false;
    csLoading = false;

    @wire(getRecord, { recordId: userId, fields: [UserName, userAlias] })
    getCurrentUserInfo({ error, data }) {
        if (data) {
            this.currentUserName = data.fields.Name.value;
            this.currentUserAlias = data.fields.Alias.value.substring(0, 2).toUpperCase();
        } else if (error) {
            console.error(`error in ready current user info with error => ${error}`);
        }
    }

    get isApiKey() {
        return this.apiKey ? true : false;
    }

    connectedCallback() {
        getKey().then(key => {
            this.apiKey = key;
            this.resetHeaderKey(key);
        }).catch(err => {
            console.error('err occured while getting custom setting record =>', error);
        });
    }

    saveApiKey(evt) {
        let fieldCmp = this.template.querySelector('lightning-input[data-id="api-field"]');
        if (fieldCmp.value) {
            this.csLoading = true;
            this.resetHeaderKey(fieldCmp.value);
            fetch(this.chatEndPoint, this.generateParameters('POST', this.role, 'test'))
                .then((response) => response.json())
                .then((data) => {
                    console.log(data);
                    if (!data.hasOwnProperty('error')) {
                        const fields = {};
                        fields[apiKeyField.fieldApiName] = fieldCmp.value;
                        console.log(fields);
                        const csDef = { apiName: askMeBuddyCS.objectApiName, fields: fields };
                        createRecord(csDef)
                            .then(cs => {
                                this.apiKey = fieldCmp.value;
                                this.resetHeaderKey(key);
                                fieldCmp.setCustomValidity('');
                                this.template.querySelector('.parent-save').classList.add('slds-align-bottom');
                                fieldCmp.reportValidity();
                                this.csLoading = false;
                            })
                            .catch(error => {
                                console.error('err occured while creating custom setting record => ', error);
                                this.csLoading = false;
                            });
                    } else {
                        this.template.querySelector('.parent-save').classList.remove('slds-align-bottom');
                        this.template.querySelector('.parent-save').classList.add('slds-align-center');
                        fieldCmp.setCustomValidity('api key is invalid');
                        fieldCmp.reportValidity();
                        this.csLoading = false;
                    }
                })
                .catch(error => {
                    console.error('err occured while creating custom setting record =>', error)
                    this.csLoading = false;
                });
        }
        else {
            this.template.querySelector('.parent-save').classList.remove('slds-align-bottom');
            this.template.querySelector('.parent-save').classList.add('slds-align-center');
            fieldCmp.setCustomValidity('api key is required');
            fieldCmp.reportValidity();
        }
    }
    generateJSONBody(role, query) {
        return JSON.stringify({ 'model': this.model, 'messages': [{ 'role': role, 'content': query }] });
    }
    generateParameters(method, role, query) {
        let paramters = {};
        paramters.method = method;
        paramters.headers = this.headers;
        paramters.body = this.generateJSONBody(role, query);
        return paramters;
    }

    askFromBuddy() {
        let userInput = this.template.querySelector('lightning-input[data-id="userinputText"]');
        if (userInput && userInput.value) {
            let uniqueId = this.uuidv4();
            let userInp = { id: uniqueId, isAssistant: false, content: userInput.value }
            this.chatData.push(userInp);
            this.fetchUserInp(userInput.value);
            userInput.value = '';
        }
        else {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'value missing',
                    message: 'Please enter some text to ask from buddy!',
                    variant: 'error',
                    mode: 'pester'
                }));
        }
        //userInput.reportValidity();
    }

    uuidv4() {
        let u = Date.now().toString(16) + Math.random().toString(16) + '0'.repeat(16);
        return [u.substr(0, 8), u.substr(8, 4), '4000-8' + u.substr(13, 3), u.substr(16, 12)].join('-');
    }
    searchQuery(evt) {
        if (evt.keyCode === 13)
            this.askFromBuddy();
    }
    fetchUserInp(query) {
        this.isLoading = true;
        let assistantInput = { id: this.uuidv4(), isAssistant: true };
        fetch(this.chatEndPoint, this.generateParameters('POST', this.role, query))
            .then((response) => response.json())
            .then((data) => {
                if (data.error) {
                    assistantInput.content = `<span style="color:red;">${data.error.message}</span>`;
                    this.chatData.push(assistantInput);
                }
                else if (data.id && data.choices && data.choices.length) {
                    data.choices.forEach(itr => {
                        if (itr.message && itr.message.content) {
                            let msgContent = itr.message.content.replace(/```([\s\S]*?)```/gm, `<pre><code>$1</pre></code>`);;
                            this.chatData.push({ id: this.uuidv4(), isAssistant: true, content: msgContent });
                        }
                    });
                }
                this.isLoading = false;
            }).catch((err) => {
                console.log(err);
                assistantInput.content = '<span style="color:red;">There is some error encounterd in connection!</span>';
                this.chatData.push(assistantInput);
                this.isLoading = false;
            });
    }

    resetHeaderKey(key) {
        this.headers.Authorization = `Bearer ${key}`;
    }

}