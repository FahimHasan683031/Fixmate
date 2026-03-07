import { PhoneNumberUtil } from 'google-libphonenumber';

export const validPhoneNumberCheck = (phone: string): boolean => {
    try {
        const phoneUtil = PhoneNumberUtil.getInstance();
        const phoneNumber = phoneUtil.parseAndKeepRawInput(phone);

        return phoneUtil.isValidNumber(phoneNumber);
    } catch (error) {
        console.error('Invalid phone number format:', error);
        return false;
    }
};
