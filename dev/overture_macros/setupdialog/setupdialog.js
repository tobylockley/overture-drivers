// options:
// - template: the html + CSS template of the dialog
// - driverPath: URL of the root folder of the driver
// - api: an API wrapper which provides services like $http, $q, $timeout, APiService, etc.
return function createCustomDialog(options) {
  return function() {
    return {
      restrict: 'E',
      scope: {
        setupData: '=',
        driverInfo: '=',
        api: '=',
        point: '='
      },
      template: options.template,
      link: function(scope, element, attrs) {
        scope.removeVariable = function(index) {
          scope.setupData.variables.splice(index, 1)
        }

        scope.toggleOptions = function(task) {
          task.trigger.options.visible = !task.trigger.options.visible
        }

        scope.addVariable = function() {
          scope.setupData.variables.push({
            name: '',
            type: 'enum',
            values: [
              {
                value: '',
                actions: [],
                options: {
                  cancelOthers: false
                }
              }
            ]
          })
        }

        scope.addValue = function(variable) {
          variable.values.push({
            value: '',
            actions: [],
            options: {
              cancelOthers: false
            }
          })
        }

        scope.removeValue = function(variable, index) {
          variable.values.splice(index, 1)
        }

        scope.api.onClose = reason => {
          scope.setupData.variables && scope.setupData.variables.forEach(x => {
            if( !(x.name && x.name.match(/^[a-zA-Z][a-zA-Z0-9_]+$/)) ) {
              throw new Error(`Incorrect variable name: ${x.name}`)
            }
          });
        } 

      }
    }
  }
}
