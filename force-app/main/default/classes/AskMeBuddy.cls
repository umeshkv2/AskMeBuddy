public class AskMeBuddy 
{
    @AuraEnabled(cacheable=true)
    public static string getKey()
    {
        return AskMeBuddy__c.getOrgDefaults().Api_key__c;
    }
}