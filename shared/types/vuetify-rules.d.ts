import type {ValidationRuleBuilderWithoutOptions} from "vuetify/labs/rules";

declare module 'vuetify/labs/rules' {

    interface RuleAliases {
        password: ValidationRuleBuilderWithoutOptions
    }
}