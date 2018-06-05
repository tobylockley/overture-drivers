# Macros behavior

## Overview

This behavior allows to create `macros`. A `macro` is an user defined room variables like `Presets`, `Sources`, `Volume`, etc, which can trigger some actions.
Actions can be triggered depending on the value of these variables: e.g. "when the `Presets` room variable is set to `Meeting` turn the room display on and switch the source to input HDMI2".

Most of the times an "Action" are merely setting a variable value but more advances variants are possible, (as detailed below). 

This driver requires :

* Control Server version 1.4.0 or upper
* UX Server version 3.2.0 or upper


## Setup

The setup of the behavior allows defining custom room variables. These variables will be attached to the room when the setup completes and the point is saved. The user can configure these following fields of each variable:

- `Name`: the name of the variable.
- `Type`: the type of the variable. Type can be either `enum`, `integer`, `string` or `real`
- `Value`: for enum variables, this where you define each string value of the enum. Leave `Value` as a blank field for other types of variables. For those types, you can refer to the set value of the Room Variable by using $value in the `Actions`.  ( E.g. for the Action you specify  Variable/Statement: `+_DSP.OutputLevel2`, Value: `$value - 10`)
- `Actions`: the list of actions which must be executed when the variable changes (and changes to the specified `value` for enum variables). See [Actions](#actions).


The setup of the behavior allows to define Triggers. With a Trigger you can specify which actions to taken when the condition is valid. Typically you will use a Trigger when you want something to happen automatically when anothers variables have a certain value (e.g. to switch on the room when the presence sensor detects presence, or switch on the display to the correct source, when a ClickShare Button gets connected).

### Actions

Actions are a list of actions which are executed in order. An Action can be:

- set a variable to a value
- wait for a certain amount of milliseconds (by specifying `wait` as variable, and the time in milliseconds as value)
- execute a JavaScript expression (by specifying `exp` as as variable and the expression as value). See [Values and Expressions](#values-and-expressions).

To set a variable to a certain value, you have to specify the variable reference, as well as the value.

### Variable References

Specifying the variable name can be done in the following ways:

- a global variable reference: `Malaga_Projector.Power`
- a postfix: `+_Projector.Power`. This will resolve to `Malaga_Projector.Power` if the room point name is `Malaga`.
- a device variable: `.Power`. This will resolve to `Malaga.Power` if the room point name is `Malaga`.
- a point filter expression (available only in Actions): the expression syntax is identical to the ones used in the Control Panels. Example `{ parent: point, variablename: '.Power', depth: 2 }`, which will look for all variables that have'.Power' in their name and are at depth 2 (children of children) of the current point (the room). 

### Values and Expressions

The behavior supports either simple values and JavaScript expressions.

**Simple Values**

You can type either a string or a number in the value field. 

Examples:  

- `On` will be interpreted as string by the behavior
- `1` will be interpreted as a number. 

**Expressions**

Expressions are JavaScript expressions where the full set of JavaScript operators and grouping (parenthesis) can be used. 
Examples:

- `||`: OR operator
- `&&`: AND operator
- `==`: IS_EQUAL operator
- `!==`: IS_NOTEQUAL operator

Expressions can also make use of several functions made available by the behavior:

- `val(variable_ref)`: shortcut for `getVarValue(variable_ref)`
- `str(variable_ref)`: shortcut for `getVarString(variable_ref)`
- `val(variable_ref, value)`: shortcut for `setVarRequiredValue(variable_ref, value)`
- `str(variable_ref, string)`: shortcut for `setVarRequiredString(variable_ref, string)`

- `getVarValue(variable_ref)`: returns the value of the specified variable. Note: `variable_ref` cannot be a filter.
- `getVarString(variable_ref)`: returns the 'string' value of the variable. Note: `variable_ref` cannot be a filter.
- `perform(ref, action, params)`: sends a command to the referenced point (usually a device). 
- `setVarRequiredValue(variable_ref, value)`: sets the value of the referenced variable. Note: filters are supported.
- `setVarRequiredString(variable_ref, string)`: sets the value of the referenced variable. Note: filters are supported.

### Point Organization Strategies 

One of the nice features of Overture is that it can easily replicate a configuration for many rooms. This really matters when the installation has dozens of rooms and makes configuration and maintenance of an installation a snap. However this requires the configurator to use a well defined and consistent point structure and to use 'relative references' for specifying points. There are two main strategies:

- using a consistent naming convention
- tagging points in the project

When configuring Overture these two strategies are often mixed, depending on the use case.

#### Consistent Naming Convention

This strategy consists in using a consistent scheme for the `variable_name` of various points of the installation. This allows the configurator to take advantage of the 'smart + notation' provided by the behavior. This strategy is simple and easy to understand but requires a bit of up-front organization when creating a project.

Example:

```
- Building_A
  - Osaka 
    - Osaka_Projector
    - Osaka_AVConference
    - Osaka_Lighting
    - Osaka_DSP
  - Madrid
    - Madrid_Projector
    - Madrid_AVConference
    - Madrid_Lighting
    - Madrid_DSP
```

Using this naming convention you can configure a behavior for the room 'Osaka' and then easily apply this configuration for the room 'Madrid' by utilizing the '+ notation'. 

The variable name `+_Projector.Power` would be translated to `Osaka_Projector.Power` for the 'Osaka' room. And it would be translated to `Madrid_Projector.Power` for the 'Madrid' room, and so on for the other rooms.

#### Using tags

This strategy consists in tagging the various points of the installation with tags and using point filter expressions.
Tagging is more flexible and more dynamic than using a strict naming convention but it is a bit more complex to implement and configure.

```
- Building_A
  - Osaka 
    - Osaka_SonyProjector
      - Osaka_SonyProjector.Power  tags: ['projpower']
    - ... other devices
  - Madrid
    - Madrid_BarcoProjector
      - Madrid_BarcoProjector.Power  tags: ['projpower']
    - ... other devices
```

You can then use the following action to power the projector on: 
- Variable/Statement: `{ parent: point, depth: 2, tags:[‘projpower']}`. Value: `On`.


### Examples

The examples below applies to projects which uses an "consistent naming convention". 

#### Expose a room variable named "Presets" and configure the room when the "Presentation" preset is selected

For projects using an unified naming convention. 

- Add a new variable named 'Presets' of type 'enum' in the 'Variables' section.
- Add the 'Presentation', 'Discussion' and 'AV Conference' enum values to the variable.
- add the following actions to the 'Presentation' value:
    - Variable/Statement: `+_Projector.Sources`, Value: `DVI`
    - Variable/Statement: `+_Display.Sources`, Value: `HDMI1`
    - Variable/Statement: `+_Lights.Presets`, Value: `Meeting`
    - Variable/Statement: `+_Projector.Shutter`, Value: `Opened`

## Revisions

### 2.0.0

- initial version

### 2.0.1

- fixed: variable actual values are reset when the behavior configuration is modified
