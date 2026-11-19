import { Text } from 'react-native';

/**
 * The name of a box that must be filled in, as "*How many arrived required":
 * a red star before it and "required" after it, both in red (as on the
 * website, resources/js/components/required-label.tsx).
 */
export default function RequiredLabel({ children }: { children: string }) {
    return (
        <Text className="font-sans-bold text-sm text-slate-700">
            <Text className="text-red-600">*</Text>
            {children} <Text className="font-sans-bold text-xs text-red-600">required</Text>
        </Text>
    );
}

/**
 * The sentence at the top of a form: boxes marked "* required" must be
 * filled in before its save button can be pressed.
 */
export function RequiredNote({ saveLabel }: { saveLabel: string }) {
    return (
        <Text className="font-sans text-sm text-slate-700">
            Fields marked <Text className="font-sans-bold text-red-600">*</Text>{' '}
            <Text className="font-sans-bold text-xs text-red-600">required</Text> must be filled in before {saveLabel} can
            be pressed.
        </Text>
    );
}