var Manipulatr = (function () {
    'use strict';
    
    // Constants
    
    var DATA_ATTRIBUTE_PREFIX = 'data-manipulatr-';
    var DATA_ATTRIBUTE_PREFIX_LENGTH = DATA_ATTRIBUTE_PREFIX.length;
    var DATA_ATTRIBUTE_NAME_SUFFIX = 'name';
    
    // Shortcuts
    var iterate = Array.prototype.forEach;
    var noop = function () {};
    
    // Utilities
    var starts_with = function (string, sub_string) {
        return string.substr(0, sub_string.length) === sub_string;
    };
    
    // Check for canvas support creating a dummy module if not
    var is_canvas_available = function () {
        var canvas = document.createElement('canvas');
        if (!canvas.getContext) {
            return false;
        } else {
            if (canvas.toDataURL('image/png').indexOf('data:image/png') < 0) {
                return false;
            } else {
                return true;
            }
        }
    };
    if (!is_canvas_available()) {
        return {
            register: noop,
            run: noop
        };
    }
    
    // Manipulatrs
    
    var MANIPULATRS = {
        scale: function (image, canvas, context, settings) {
            var new_width, new_height;
            if ('percentage' in settings) {
                var scale_factor = settings.percentage / 100;
                new_width = Math.floor(image.width * scale_factor);
                new_height = Math.floor(image.height * scale_factor);
            } else {
                new_width = settings.width;
                new_height = settings.height;
            }
            
            canvas.width = new_width;
            canvas.height = new_height;
            context.drawImage(
                image,
                0,
                0,
                new_width,
                new_height
            );
        },
        
        rotate: function (image, canvas, context, settings) {
            var width = image.width;
            var height = image.height;
            var rotation_angle, translate_x, translate_y, new_width, new_height;
            switch (settings.mode) {
                case 'left':
                    rotation_angle = 3 * Math.PI / 2;
                    translate_x = -width;
                    translate_y = 0;
                    new_width = height;
                    new_height = width;
                    break;
                case 'right':
                    rotation_angle = Math.PI / 2;
                    translate_x = 0;
                    translate_y = -height;
                    new_width = height;
                    new_height = width;
                    break;
                case 'half':
                    rotation_angle = Math.PI;
                    translate_x = -width;
                    translate_y = -height;
                    new_width = width;
                    new_height = height;
                    break;
            }
            
            canvas.width = new_width;
            canvas.height = new_height;
            context.rotate(rotation_angle);
            context.translate(translate_x, translate_y);
            context.drawImage(image, 0, 0, width, height);
        },
        
        flip: function (image, canvas, context, settings) {
            var width = image.width;
            var height = image.height;
            canvas.width = width;
            canvas.height = height;
            
            if (settings.direction === 'vertical') {
                context.translate(0, height);
                context.scale(1,-1);
            } else if (settings.direction === 'horizontal') {
                context.translate(width, 0);
                context.scale(-1,1);
            }
            context.drawImage(image, 0, 0, width, height);
        },
        
        grayscale: function (image, canvas, context, settings) {
            var width = image.width;
            var height = image.height;
            canvas.width = width;
            canvas.height = height;
            context.drawImage(image, 0, 0, width, height);
            
            var image_data = context.getImageData(0, 0, width, height);
            var pixel_data = image_data.data;
            for (var i = 0; i < pixel_data.length; i += 4) {
                var brightness = (
                    0.34 * pixel_data[i] +
                    0.5 * pixel_data[i + 1] +
                    0.16 * pixel_data[i + 2]
                );
              
                pixel_data[i] = brightness;
                pixel_data[i + 1] = brightness;
                pixel_data[i + 2] = brightness;
            }

            context.putImageData(image_data, 0, 0);
        }
    };
    
    var register_manipulatr = function (name, manipulatr) {
        if (name in MANIPULATRS) {
            throw new Error(
                'A manipulatr called "' + name + '" is already registered!'
            );
        }
        
        MANIPULATRS[name] = manipulatr;
    };
    
    // Processing of images
    
    var process_images = function (images) {
        iterate.call(images, function (image) {
            var settings = convert_data_attributes_to_settings(image);
            process_image(image, settings);
        });
    };
    
    var process_image = function (image, settings) {
        var manipulatr_name = settings[DATA_ATTRIBUTE_NAME_SUFFIX];

        var manipulatr = MANIPULATRS[manipulatr_name];
        if (!manipulatr) {
            return;
        }
        
        var manipulatr_settings = settings[manipulatr_name];
        var canvas = document.createElement('canvas');
        var context = canvas.getContext('2d');
        var mime_type = guess_image_mime_type(settings.format || image.src);
        image.onload = function () {
            try {
                manipulatr(image, canvas, context, manipulatr_settings);
            } catch (error) {
                return;
            }
            image.src = canvas.toDataURL(mime_type);
            image.onload = null;
        };
    };
    
    var convert_data_attributes_to_settings = function (element) {
        var settings = {};
        iterate.call(element.attributes, function (attribute) {
            if (starts_with(attribute.name, DATA_ATTRIBUTE_PREFIX)) {
                var unprefixed_attribute_name = attribute.name.substr(
                    DATA_ATTRIBUTE_PREFIX_LENGTH
                );
                var settings_parts = unprefixed_attribute_name.split('-');
                var outer_setting = settings_parts[0];
                var inner_setting = settings_parts[1];
                var setting_value = attribute.value;
                // If the setting is anything other than a string try to coerce it
                try {
                    setting_value = JSON.parse(setting_value);
                } catch (error) {}
                
                // Determine whether this setting is namespaced or root setting
                if (typeof inner_setting === 'undefined') {
                    settings[outer_setting] = attribute.value;
                } else {
                    if (!(outer_setting in settings)) {
                        settings[outer_setting] = {};
                    }
                    settings[outer_setting][inner_setting] = attribute.value;
                }
            }
        });
        return settings;
    };
    
    var guess_image_mime_type = function (image_src) {
        var image_extension;
        try {
            image_extension = image_src.split('.').pop(-1);
        } catch (error) {}
        
        var image_mime_type;
        switch (image_extension.toLowerCase()) {
            case 'gif':
                image_mime_type = 'image/gif';
                break;
            case 'png':
                image_mime_type = 'image/png';
                break;
            default:
                image_mime_type = 'image/jpeg';
                break;
        }
        return image_mime_type;
    };
    
    window.addEventListener('DOMContentLoaded', function () {
        var images = document.querySelectorAll(
            'img[' + DATA_ATTRIBUTE_PREFIX + DATA_ATTRIBUTE_NAME_SUFFIX + ']'
        );
        process_images(images);
    });
    
    // Public API
    return {
        register: register_manipulatr,
        run: process_image
    };
    
})();